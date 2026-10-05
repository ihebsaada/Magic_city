import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { requestJSON, HttpError, RequestTimeoutError } from "@/services/request";
import { getProductByHandle, getProductsByCollection } from "@/services/productService";
import { createCheckoutIntentFromCart } from "@/services/orderService";
import { productsQuery, productQuery, collectionProductsQuery, catalogueQuery, catalogQueryDefaults } from "@/lib/productQueries";
import { QueryFeedback } from "@/components/QueryFeedback";
import ProductDetail from "@/pages/ProductDetail";
import Catalog from "@/pages/Catalog";
import Collections from "@/pages/Collections";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import type { Product } from "@/types/product";

const clients: QueryClient[] = [];
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(), key: () => null, length: 0,
};
// A test must explicitly supply its response; accidental network access fails.
globalThis.fetch = async () => { throw new Error("Live network disabled in tests"); };
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  storage.clear();
  globalThis.fetch = async () => { throw new Error("Live network disabled in tests"); };
});
const client = () => {
  const value = new QueryClient();
  clients.push(value);
  return value;
};
const product: Product = {
  id: 1, handle: "test-product", title: "Test product", mainImage: "test.jpg", images: ["test.jpg"],
  price: 20, brand: "Test", description: "Synthetic product", collection: "test-collection",
  sizes: ["M"], colors: ["Blue"], stock: 5,
};
const abortedPromise = (signal: AbortSignal) => new Promise<never>((_, reject) => {
  const abort = () => reject(new DOMException("Cancelled", "AbortError"));
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
});
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

test("request deadline aborts a hung fetch", async () => {
  let signal: AbortSignal;
  globalThis.fetch = async (_, init) => { signal = init!.signal!; return abortedPromise(signal); };
  await assert.rejects(requestJSON("https://test.invalid", {}, { timeoutMs: 10 }), RequestTimeoutError);
  assert.equal(signal!.aborted, true);
});

test("request deadline also covers a hung JSON body", async () => {
  globalThis.fetch = async (_, init) => {
    const result = response({});
    result.json = () => abortedPromise(init!.signal!);
    return result;
  };
  await assert.rejects(requestJSON("https://test.invalid", {}, { timeoutMs: 10 }), RequestTimeoutError);
});

test("caller cancellation reaches fetch without being reported as timeout", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_, init) => abortedPromise(init!.signal!);
  const pending = requestJSON("https://test.invalid", {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("already-cancelled reads cannot complete", async () => {
  const controller = new AbortController(); controller.abort();
  globalThis.fetch = async (_, init) => abortedPromise(init!.signal!);
  await assert.rejects(requestJSON("https://test.invalid", {}, { signal: controller.signal }), { name: "AbortError" });
});

test("successful request removes cancellation listener", async () => {
  const controller = new AbortController(); let requestSignal: AbortSignal;
  globalThis.fetch = async (_, init) => { requestSignal = init!.signal!; return response({ ok: true }); };
  assert.deepEqual(await requestJSON("https://test.invalid", {}, { signal: controller.signal }), { ok: true });
  controller.abort();
  assert.equal(requestSignal!.aborted, false);
});

test("detail 404 remains not-found; collection 404 is a visible error", async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  assert.equal(await getProductByHandle("missing"), null);
  await assert.rejects(getProductsByCollection("missing"), (error: HttpError) => error.status === 404);
});

test("fresh catalog data is reused and simultaneous reads deduplicated", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response([product]); };
  const queryClient = client();
  await Promise.all([queryClient.fetchQuery(productsQuery()), queryClient.fetchQuery(productsQuery())]);
  await queryClient.fetchQuery(productsQuery());
  assert.equal(calls, 1);
  await queryClient.invalidateQueries({ queryKey: ["products"] });
  await queryClient.fetchQuery(productsQuery());
  assert.equal(calls, 2);
});

test("collection cover, catalog and related reads use the same cache", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response({ products: [product] }); };
  const queryClient = client();
  await queryClient.fetchQuery(collectionProductsQuery("test-collection"));
  await queryClient.fetchQuery(collectionProductsQuery("test-collection"));
  assert.equal(calls, 1);
});

test("unmounting the last observer aborts an obsolete read", async () => {
  let signal: AbortSignal;
  globalThis.fetch = async (_, init) => { signal = init!.signal!; return abortedPromise(signal); };
  const observer = new QueryObserver(client(), productQuery("obsolete"));
  const unsubscribe = observer.subscribe(() => {});
  assert.ok(signal!);
  unsubscribe();
  assert.equal(signal!.aborted, true);
});

test("timeouts and 4xx do not retry; transient reads retry only once", () => {
  assert.equal(catalogQueryDefaults.retry(0, new RequestTimeoutError()), false);
  assert.equal(catalogQueryDefaults.retry(0, new HttpError(404)), false);
  assert.equal(catalogQueryDefaults.retry(0, new HttpError(503)), true);
  assert.equal(catalogQueryDefaults.retry(1, new HttpError(503)), false);
});

test("failed collection leaves pending state and can be retried successfully", async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const queryClient = client(); const options = collectionProductsQuery("missing");
  await assert.rejects(queryClient.fetchQuery(options));
  assert.equal(queryClient.getQueryState(options.queryKey)?.status, "error");
  assert.equal(queryClient.getQueryState(options.queryKey)?.fetchStatus, "idle");
  globalThis.fetch = async () => response({ products: [product] });
  assert.deepEqual(await queryClient.fetchQuery(options), [product]);
});

function renderPage(queryClient: QueryClient, path: string, element: React.ReactNode, route: string) {
  return renderToString(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}>
    <CartProvider><WishlistProvider><Routes><Route path={route} element={element} /></Routes></WishlistProvider></CartProvider>
  </MemoryRouter></QueryClientProvider>);
}

test("primary product and actions render while related products are pending", () => {
  const queryClient = client(); queryClient.setQueryData(productQuery(product.handle).queryKey, product);
  const html = renderPage(queryClient, "/product/test-product", <ProductDetail />, "/product/:handle");
  assert.match(html, /Test product/);
  assert.match(html, /Aggiungi al Carrello/);
  assert.match(html, /Lista dei Desideri/);
  assert.doesNotMatch(html, /fixed inset-0/);
});

test("catalog renders available products before collection filters load", () => {
  const queryClient = client(); queryClient.setQueryData(catalogueQuery({ page: 1, pageSize: 24, sort: "featured", collection: undefined, search: undefined, vendor: undefined, size: undefined, color: undefined, minPrice: undefined, maxPrice: undefined, sale: undefined, inStock: undefined }).queryKey, { items: [{ ...product, variants: [] }], pagination: { page: 1, pageSize: 24, total: 1, totalPages: 1, hasNext: false } });
  const html = renderPage(queryClient, "/catalog", <Catalog />, "/catalog");
  assert.match(html, /Test product/);
  assert.match(html, /1 prodotti/);
});

test("collection titles and links render before their images load", () => {
  const queryClient = client(); queryClient.setQueryData(["collections"], [{ id: 1, title: "Test collection", handle: "test-collection", productsCount: 1 }]);
  const html = renderPage(queryClient, "/collections", <Collections />, "/collections");
  assert.match(html, /Test collection/);
  assert.match(html, /href="\/collections\/test-collection"/);
});

test("local errors offer retry and distinguish retained stale data", () => {
  const html = renderToString(<QueryFeedback error hasData onRetry={() => {}} />);
  assert.match(html, /role="alert"/); assert.match(html, /Riprova/); assert.match(html, /aggiornati/);
});

test("checkout keeps the API payload and performs a single POST", async () => {
  let calls = 0; let body: unknown;
  globalThis.fetch = async (url, init) => {
    calls++; assert.match(String(url), /\/checkout\/intent$/); assert.equal(init!.method, "POST");
    body = JSON.parse(String(init!.body)); return response({ orderId: "test-order", redirectUrl: "https://test.invalid/checkout" });
  };
  const result = await createCheckoutIntentFromCart([{ product, quantity: 2, selectedSize: "M", selectedColor: "Blue" }],
    { name: "Test", email: "test@example.invalid" }, "TEST", { city: "Test city" });
  assert.equal(calls, 1); assert.equal(result.orderId, "test-order");
  assert.deepEqual(body, { customerName: "Test", customerEmail: "test@example.invalid", items: [{ productId: 1, quantity: 2, selectedSize: "M", selectedColor: "Blue" }], discountCode: "TEST", shipping: { city: "Test city" } });
});

test("failed checkout is not automatically retried by the transport", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("Offline"); };
  await assert.rejects(createCheckoutIntentFromCart([], { name: "Test", email: "test@example.invalid" }));
  assert.equal(calls, 1);
});
