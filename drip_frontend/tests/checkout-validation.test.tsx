import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider, type CartItem } from "@/contexts/CartContext";
import Cart from "@/pages/Cart";
import { refreshCart, validSelection, mergeCartLines } from "@/lib/cartValidation";
import { startPaidOrderCheck } from "@/lib/paidOrderCheck";
import { hasPendingCheckout, markCheckoutPending, clearPendingCheckout, loadCheckoutAttempt } from "@/lib/checkoutAttempt";
import { HttpError, RequestTimeoutError } from "@/services/request";
import type { Product } from "@/types/product";

const product: Product = { id: 999, handle: "synthetic", title: "Synthetic", mainImage: "new.jpg", images: ["new.jpg"],
  price: 20, brand: "Test", description: "Test", collection: "Test", sizes: ["M"], colors: ["Blue"], stock: 5 };
const line: CartItem = { product, quantity: 1, selectedSize: "M", selectedColor: "Blue" };
const pause = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));
const storage = new Map<string, string>();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); },
  removeItem: (key) => { storage.delete(key); }, clear: () => storage.clear(), key: () => null, length: 0 };
// Synthetic companion catalogue and token preparation for the historical UI cases.
// New integration tests separately assert every request and exact variant behavior.
let installedFetch: typeof fetch;
const detailFixtures = new Map<string, Product>();
Object.defineProperty(globalThis, 'fetch', { configurable: true,
  get: () => installedFetch,
  set: (handler: typeof fetch) => {
    detailFixtures.clear();
    installedFetch = async (url, init) => {
      const path = new URL(String(url));
      if (path.pathname.endsWith('/order-access/prepare')) return Response.json({ accessToken: 'A'.repeat(43), expiresAt: new Date(Date.now() + 900000).toISOString() });
      if (/\/orders\/[^/]+\/min$/.test(path.pathname)) {
        const attempt = loadCheckoutAttempt()!;
        return Response.json({ total: attempt.body.items.reduce((sum, line) => sum + [...detailFixtures.values()].find((item) => item.id === line.productId)!.price * line.quantity, 0), currency: 'EUR', paymentStatus: 'PENDING' });
      }
      if (path.pathname.endsWith('/catalog/products')) {
        const item = detailFixtures.get(path.searchParams.get('search')!);
        assert.ok(item, 'Catalogue fixture requires the preceding detail read');
        const variants = (item.sizes.length ? item.sizes : [null]).flatMap((size, i) => (item.colors.length ? item.colors : [null]).map((color, j) => ({
          id: i * 10 + j + 1, sku: null, price: item.price, compareAtPrice: null, option1: size, option2: color, option3: null, stock: item.stock,
        })));
        return Response.json({ items: [{ ...item, variants }], pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1, hasNext: false } });
      }
      const result = await handler(url, init);
      if (path.pathname.includes('/products/handle/') && result.ok) {
        const item = await result.clone().json() as Product; detailFixtures.set(item.handle, item);
      }
      return result;
    };
  },
});
globalThis.fetch = async () => { throw new Error("Live network disabled in tests"); };
let renderer: ReactTestRenderer | undefined;
let client: QueryClient | undefined;
afterEach(() => { if (renderer) act(() => renderer!.unmount()); renderer = undefined; client?.clear(); client = undefined;
  storage.clear(); globalThis.fetch = async () => { throw new Error("Live network disabled in tests"); }; });

test("fresh cart bypasses HTTP cache and deduplicates product reads", async () => {
  let count = 0;
  globalThis.fetch = async (_, init) => { count++; assert.equal(init?.cache, "no-store"); return Response.json(product); };
  const result = await refreshCart([line, { ...line, quantity: 2 }]);
  assert.equal(count, 1); assert.equal(result.items[0].quantity, 3); assert.deepEqual(result.errors, []);
});
test("cart detects price, removed variants and stock changes", async () => {
  const result = await refreshCart([line], undefined, async () => ({ ...product, price: 25, sizes: ["L"], stock: 0 }));
  assert.equal(result.items[0].product.price, 25); assert.equal(result.items[0].selectedSize, undefined);
  assert.equal(result.changes.length, 3); assert.equal(result.errors.length, 2);
});
test("stock checks sum all cart lines and invalid quantities are rejected", async () => {
  const result = await refreshCart([{ ...line, quantity: 3 }, { ...line, selectedSize: "L", quantity: 3 }], undefined,
    async () => ({ ...product, sizes: ["M", "L"] }));
  assert.match(result.errors.join(), /quantità/);
  for (const quantity of [0, -1, 1.5]) assert.ok((await refreshCart([{ ...line, quantity }], undefined, async () => product)).errors.length);
});
test("missing, malformed and failed product reads never validate a cart", async () => {
  assert.ok((await refreshCart([line], undefined, async () => null)).errors.length);
  await assert.rejects(refreshCart([line], undefined, async () => ({ ...product, price: NaN })));
  await assert.rejects(refreshCart([line], undefined, async () => { throw new TypeError("offline"); }));
});
test("refresh cancellation discards late results", async () => {
  const controller = new AbortController();
  await assert.rejects(refreshCart([line], controller.signal, async () => { controller.abort(); return product; }), { name: "AbortError" });
});
test("only current options and images survive refresh; merged lines retain quantities", () => {
  assert.deepEqual(validSelection(product, "M", "Blue", "new.jpg"), { size: "M", color: "Blue", image: "new.jpg" });
  assert.deepEqual(validSelection(product, "L", "Red", "old.jpg"), { size: undefined, color: undefined, image: "new.jpg" });
  assert.equal(validSelection({ ...product, mainImage: "removed.jpg" }).image, "new.jpg");
  assert.equal(validSelection({ ...product, images: [] }).image, "");
  assert.equal(mergeCartLines([line, line])[0].quantity, 2); assert.equal(line.quantity, 1);
});
test("paid check recovers after network error and clears once", async () => {
  let calls = 0, paid = 0;
  const stop = startPaidOrderCheck({ orderId: "synthetic-order", currentOrderId: () => "synthetic-order", onPaid: () => paid++, retryDelayMs: 1,
    read: async () => { if (++calls === 1) throw new TypeError("offline"); return { id: "synthetic-order", paymentStatus: "PAID" }; } });
  await pause(); stop(); assert.equal(calls, 2); assert.equal(paid, 1);
});
test("paid check retry budget is bounded and 404 stops immediately", async () => {
  let calls = 0;
  let stop = startPaidOrderCheck({ orderId: "test", currentOrderId: () => "test", onPaid: () => assert.fail(), retryDelayMs: 1,
    read: async () => { calls++; throw new TypeError("offline"); } });
  for (let i = 0; calls < 3 && i < 20; i++) await pause();
  stop(); assert.equal(calls, 3);
  calls = 0;
  stop = startPaidOrderCheck({ orderId: "test", currentOrderId: () => "test", onPaid: () => assert.fail(), retryDelayMs: 1,
    read: async () => { calls++; throw new HttpError(404); } });
  await pause(); stop(); assert.equal(calls, 1);
});
test("paid check cleanup and changed order discard late payment results", async () => {
  for (const cleanup of [true, false]) {
    let current = "old", resolve!: (value: { id: string; paymentStatus: string }) => void;
    const stop = startPaidOrderCheck({ orderId: "old", currentOrderId: () => current, onPaid: () => assert.fail(),
      read: () => new Promise((done) => { resolve = done; }) });
    if (cleanup) stop(); else current = "new";
    resolve({ id: "old", paymentStatus: "PAID" }); await pause(); stop();
  }
});
test("focus and online share retry budget and never overlap paid checks", async () => {
  const events = new EventTarget(); let calls = 0, resolve!: (value: { id: string; paymentStatus: string }) => void;
  const stop = startPaidOrderCheck({ orderId: "test", currentOrderId: () => "test", onPaid: () => assert.fail(), retryDelayMs: 10_000,
    events: events as unknown as Pick<Window, "addEventListener" | "removeEventListener">,
    read: () => { calls++; return new Promise((done) => { resolve = done; }); } });
  for (let i = 0; i < 3; i++) {
    events.dispatchEvent(new Event("online")); events.dispatchEvent(new Event("focus")); assert.equal(calls, i + 1);
    resolve({ id: "test", paymentStatus: "PENDING" }); await Promise.resolve();
    events.dispatchEvent(new Event("online"));
  }
  assert.equal(calls, 3); stop();
});
test("collection copy uses più", () => {
  const source = readFileSync("src/components/home/CollectionsSection.tsx", "utf8");
  assert.ok(source.includes("più")); assert.ok(!source.includes("pi?"));
});

async function mountCart() {
  const session = new Map<string, string>();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => { session.set(key, value); },
    removeItem: (key) => { session.delete(key); }, clear: () => session.clear(), key: () => null, length: 0 };
  globalThis.window = { setTimeout, clearTimeout, location: { href: "https://test.invalid" } } as unknown as Window & typeof globalThis;
  localStorage.setItem("magic-city-drip-cart", JSON.stringify([line]));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => { renderer = create(<MemoryRouter><QueryClientProvider client={client!}><CartProvider><Cart /></CartProvider></QueryClientProvider></MemoryRouter>); });
  act(() => {
    for (const input of renderer!.root.findAllByType("input")) {
      if (input.props.placeholder !== "MAGIC00") input.props.onChange({ target: { value: input.props.type === "email" ? "test@example.invalid" : "Synthetic" } });
    }
  });
}
const checkoutButton = () => renderer!.root.findAllByType("button").find((button) => button.props.className?.includes("w-full mt-6"))!;
const submit = async () => { await act(async () => { await checkoutButton().props.onClick(); }); };
test("changed price updates cart and requires second confirmation before checkout", async () => {
  let posts = 0;
  globalThis.fetch = async (_, init) => init?.method === "POST"
    ? (posts++, Response.json({ orderId: "synthetic-order", redirectUrl: "https://test.invalid/checkout" })) : Response.json({ ...product, price: 25 });
  await mountCart(); await submit(); assert.equal(posts, 0);
  assert.match(JSON.stringify(renderer!.toJSON()), /prezzo aggiornato/);
  await submit(); assert.equal(posts, 1); assert.ok(renderer!.root.findAllByType("a").some(a => String(a.props.href).includes("dripcheckout.netlify.app/checkout-landing?orderId=synthetic-order")));
});
test("failed verification blocks POST and allows a safe retry", async () => {
  let posts = 0, offline = true;
  globalThis.fetch = async (_, init) => {
    if (init?.method === "POST") { posts++; return Response.json({ orderId: "synthetic", redirectUrl: "https://test.invalid" }); }
    if (offline) throw new TypeError("offline"); return Response.json(product);
  };
  await mountCart(); await submit(); assert.equal(posts, 0); assert.equal(checkoutButton().props.disabled, false);
  offline = false; await submit(); assert.equal(posts, 1);
});
test("checkout timeout preserves a replayable attempt across component remount", async () => {
  let posts = 0;
  globalThis.fetch = async (_, init) => { if (init?.method === "POST") { posts++; throw new RequestTimeoutError(); } return Response.json(product); };
  await mountCart(); await submit(); assert.equal(posts, 1); assert.equal(checkoutButton().props.disabled, false); assert.equal(hasPendingCheckout(), true);
  const saved = loadCheckoutAttempt(); await submit(); assert.equal(posts, 2); assert.equal(loadCheckoutAttempt()?.key, saved?.key);
  act(() => renderer!.unmount());
  act(() => { renderer = create(<MemoryRouter><QueryClientProvider client={client!}><CartProvider><Cart /></CartProvider></QueryClientProvider></MemoryRouter>); });
  assert.equal(checkoutButton().props.disabled, false); clearPendingCheckout();
});
test("removed variant can be reselected from updated cart options", async () => {
  let posts = 0;
  globalThis.fetch = async (_, init) => init?.method === "POST"
    ? (posts++, Response.json({ orderId: "synthetic", redirectUrl: "https://test.invalid" })) : Response.json({ ...product, sizes: ["L"] });
  await mountCart(); await submit(); assert.equal(posts, 0);
  const size = renderer!.root.findAllByType("select")[0]; assert.equal(size.props.value, "");
  act(() => size.props.onChange({ target: { value: "L" } })); await submit(); assert.equal(posts, 1);
});
test("storage guard blocks before POST if pending attempt cannot be persisted", async () => {
  let posts = 0;
  globalThis.fetch = async (_, init) => { if (init?.method === "POST") posts++; return Response.json(product); };
  await mountCart(); sessionStorage.setItem = () => { throw new Error("Storage disabled"); };
  await submit(); assert.equal(posts, 0); assert.equal(checkoutButton().props.disabled, false);
});
test("double click shares one verification and one checkout request", async () => {
  let reads = 0, posts = 0, resolve!: (value: Response) => void;
  globalThis.fetch = async (_, init) => {
    if (init?.method === "POST") { posts++; return Response.json({ orderId: "synthetic", redirectUrl: "https://test.invalid" }); }
    reads++; return new Promise<Response>((done) => { resolve = done; });
  };
  await mountCart();
  await act(async () => {
    const click = checkoutButton().props.onClick;
    const first = click(); const second = click();
    assert.equal(reads, 1); resolve(Response.json(product)); await Promise.all([first, second]);
  });
  assert.equal(posts, 1);
});
test("leaving cart aborts pending verification without creating an order", async () => {
  let signal!: AbortSignal, posts = 0;
  globalThis.fetch = async (_, init) => {
    if (init?.method === "POST") { posts++; return Response.json({}); }
    signal = init!.signal!;
    return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true }));
  };
  await mountCart();
  await act(async () => {
    const pending = checkoutButton().props.onClick(); renderer!.unmount(); await pending;
  });
  renderer = undefined; assert.equal(signal.aborted, true); assert.equal(posts, 0);
});
test("definite checkout rejection clears guard and permits corrected retry", async () => {
  let posts = 0;
  globalThis.fetch = async (_, init) => {
    if (init?.method === "POST") { posts++; return new Response("{}", { status: 400 }); }
    return Response.json(product);
  };
  await mountCart(); await submit(); assert.equal(hasPendingCheckout(), false); assert.equal(loadCheckoutAttempt()?.state, "rejected"); assert.equal(checkoutButton().props.disabled, false);
  await submit(); assert.equal(posts, 2);
});
test("pending marker is cleared only explicitly", () => {
  const values = new Map<string, string>();
  globalThis.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }, clear: () => values.clear(), key: () => null, length: 0 };
  markCheckoutPending(); assert.equal(hasPendingCheckout(), true);
  clearPendingCheckout(); assert.equal(hasPendingCheckout(), false);
});

 test("Store cart remains intact for PENDING, denied access and PAID of a different order",async()=>{
 for(const response of [{id:'other',paymentStatus:'PAID'},{id:'expected',paymentStatus:'PENDING'}]){
 let cleared=0;const stop=startPaidOrderCheck({orderId:'expected',currentOrderId:()=> 'expected',onPaid:()=>cleared++,maxAttempts:1,read:async()=>response});await pause();stop();assert.equal(cleared,0);
 }
 let cleared=0,required=0;const stop=startPaidOrderCheck({orderId:'expected',currentOrderId:()=> 'expected',onPaid:()=>cleared++,onAccessRequired:()=>required++,read:async()=>{throw new HttpError(401,'ORDER_ACCESS_DENIED');}});await pause();stop();assert.equal(cleared,0);assert.equal(required,1);
 });
