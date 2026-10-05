import {Select} from '@/components/ui/select';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { CartProvider, useCart } from '@/contexts/CartContext';
import { catalogueQuery } from '@/lib/productQueries';
import { getCatalogue, getProductWithVariants, cardAsProduct } from '@/services/productService';
import { refreshCart } from '@/lib/cartValidation';
import { selectedVariant, variantProduct } from '@/lib/productVariants';
import { newCheckoutAttempt, loadCheckoutAttempt, resumeCheckoutAttempt, startDistinctPurchase, orderAccessToken, checkoutErrorMessage, markCheckoutPending, checkCheckoutTotal, confirmCheckoutTotal } from '@/lib/checkoutAttempt';
import { requestJSON, HttpError, RequestTimeoutError } from '@/services/request';
import { startPaidOrderCheck } from '@/lib/paidOrderCheck';
import { CatalogueBrowser } from '@/components/CatalogueBrowser';
import { CollectionCard } from '@/components/CollectionCard';
import Wishlist from '@/pages/Wishlist';
import Cart from '@/pages/Cart';
import type { Product, CatalogueCard, CataloguePage } from '@/types/product';
import type { CheckoutPayload } from '@/services/orderService';

const values = new Map<string, string>();
const storage: Storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
  removeItem: (key) => { values.delete(key); }, clear: () => values.clear(), key: () => null, length: 0 };
globalThis.sessionStorage = storage;
globalThis.localStorage = storage;
globalThis.window = { setTimeout, clearTimeout, location: { href: 'https://test.invalid' } } as unknown as Window & typeof globalThis;
globalThis.fetch = async () => { throw new Error('Live API disabled'); };
const clients: QueryClient[] = [];
let renderer: ReactTestRenderer | undefined;
afterEach(() => {
  if (renderer) act(() => renderer!.unmount()); renderer = undefined;
  clients.splice(0).forEach((client) => client.clear()); values.clear();
  globalThis.sessionStorage = storage;
  globalThis.fetch = async () => { throw new Error('Live API disabled'); };
});
const client = () => { const value = new QueryClient(); clients.push(value); return value; };
const pause = (ms = 20) => new Promise((done) => setTimeout(done, ms));
const product: Product = { id: 1, handle: 'synthetic', title: 'Synthetic', brand: 'Test', collection: 'test', description: 'Full description',
  images: ['one.jpg', 'two.jpg'], mainImage: 'one.jpg', sizes: ['M', 'L'], colors: ['Blue', 'Red'], stock: 4, price: 10,
  variants: [
    { id: 11, sku: null, option1: 'M', option2: 'Blue', option3: null, stock: 1, price: 10, compareAtPrice: null },
    { id: 12, sku: null, option1: 'L', option2: 'Red', option3: null, stock: 3, price: 12.35, compareAtPrice: 20 },
  ] };
const card: CatalogueCard = { ...product, variants: product.variants! };
const page = (items: CatalogueCard[], n = 1, total = items.length, pageSize = 24): CataloguePage => ({ items,
  pagination: { page: n, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: n * pageSize < total } });
const body: CheckoutPayload = { customerName: 'Synthetic', customerEmail: 'synthetic@example.invalid',
  items: [{ productId: 1, quantity: 1, selectedSize: 'M', selectedColor: 'Blue' }], shipping: { city: 'Test' } };
const token = 'S'.repeat(43);
const result = { orderId: 'synthetic-order', redirectUrl: 'https://checkout.test.invalid/?orderId=synthetic-order' };
function api(order: (init: RequestInit) => Promise<Response> | Response) {
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('http://localhost:4000/api/'));
    if (String(url).endsWith('/order-access/prepare')) return Response.json({ accessToken: token, expiresAt: new Date(Date.now() + 900000).toISOString() });
    assert.ok(String(url).endsWith('/checkout/intent'));
    return order(init!);
  };
}
const rejectCode = (status: number, error: string) => Response.json({ error }, { status });

test('pagination accesses products after 24 without changing the historical service', async () => {
  const dataset = Array.from({ length: 55 }, (_, index) => ({ ...card, id: index + 1, handle: `synthetic-${index + 1}` }));
  globalThis.fetch = async (url) => {
    const query = new URL(String(url)); assert.equal(query.pathname, '/api/catalog/products');
    const n = Number(query.searchParams.get('page')); return Response.json(page(dataset.slice((n - 1) * 24, n * 24), n, 55));
  };
  const pages = await Promise.all([1, 2, 3].map((n) => getCatalogue({ page: n })));
  assert.equal(pages[1].items[0].id, 25); assert.equal(pages[2].items.length, 7);
  assert.equal(pages[2].pagination.hasNext, false);
  assert.equal(new Set(pages.flatMap((entry) => entry.items.map((item) => item.id))).size, 55);
});
test('filters and global sort are transmitted to the server with literal search encoding', async () => {
  globalThis.fetch = async (url) => {
    const params = new URL(String(url)).searchParams;
    for (const [key, value] of Object.entries({ search: '%_\\&', collection: 'test', vendor: 'Test', size: 'L', color: 'Red',
      inStock: 'true', sale: 'false', minPrice: '12.00', maxPrice: '20.00', sort: 'price-desc', page: '2', pageSize: '24' })) assert.equal(params.get(key), value);
    return Response.json(page([card], 2, 50));
  };
  await getCatalogue({ search: '%_\\&', collection: 'test', vendor: 'Test', size: 'L', color: 'Red', inStock: true,
    sale: false, minPrice: '12.00', maxPrice: '20.00', sort: 'price-desc', page: 2 });
});
test('different pages, searches, filters and sorts cannot share a React Query cache entry', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json(page([card])); };
  const qc = client();
  for (const filters of [{}, { page: 2 }, { search: 'rare' }, { vendor: 'Test' }, { size: 'M', color: 'Blue' }, { sort: 'price-asc' as const }]) await qc.fetchQuery(catalogueQuery(filters));
  assert.equal(calls, 6); await qc.fetchQuery(catalogueQuery({})); assert.equal(calls, 6);
  assert.equal(qc.getQueryData(['product', product.handle]), undefined);
});
test('rapid query changes cancel obsolete fetches and never publish their late results', async () => {
  let oldSignal!: AbortSignal, finishOld!: (value: Response) => void;
  globalThis.fetch = async (url, init) => {
    if (new URL(String(url)).searchParams.get('search') === 'old') {
      oldSignal = init!.signal!; return new Promise<Response>((done) => { finishOld = done; });
    }
    return Response.json(page([{ ...card, title: 'Current' }]));
  };
  const observer = new QueryObserver(client(), catalogueQuery({ search: 'old' }));
  const unsubscribe = observer.subscribe(() => {});
  observer.setOptions(catalogueQuery({ search: 'new' }));
  assert.equal(oldSignal.aborted, true); finishOld(Response.json(page([{ ...card, title: 'Old' }])));
  await pause(); assert.equal(observer.getCurrentResult().data?.items[0].title, 'Current'); unsubscribe();
});
test('catalogue UI pages on the server and resets page on sort change', async () => {
  const calls: URL[] = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url));
    if (path.pathname.endsWith('/collections')) return Response.json([]);
    calls.push(path); const n = Number(path.searchParams.get('page'));
    return Response.json(page([{ ...card, title: `Page ${n}` }], n, 55));
  };
  const qc = client();
  act(() => { renderer = create(<QueryClientProvider client={qc}><MemoryRouter><WishlistProvider><CatalogueBrowser /></WishlistProvider></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await pause(); });
  await act(async () => { renderer!.root.findAllByType('button').find((button) => button.children.includes('Successiva'))!.props.onClick(); await pause(); });
  assert.equal(calls.at(-1)!.searchParams.get('page'), '2'); assert.match(JSON.stringify(renderer!.toJSON()), /Page 2/);
  await act(async () => { renderer!.root.findAllByType(Select)[1].props.onValueChange('price-desc'); await pause(); });
  assert.equal(calls.at(-1)!.searchParams.get('page'), '1'); assert.equal(calls.at(-1)!.searchParams.get('sort'), 'price-desc');
});
test('collection covers load one card and never the entire collection', async () => {
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)); assert.equal(path.pathname, '/api/catalog/products');
    assert.equal(path.searchParams.get('collection'), 'test'); assert.equal(path.searchParams.get('pageSize'), '1');
    return Response.json(page([card], 1, 3000, 1));
  };
  act(() => { renderer = create(<QueryClientProvider client={client()}><MemoryRouter><CollectionCard collection={{ id: 1, handle: 'test', title: 'Test', productsCount: 3000 }} /></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await pause(); }); assert.equal(renderer!.root.findByType('img').props.src, 'one.jpg');
});
test('exact variant companion matches ID and handle even beyond first search page, retaining full gallery', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(init!.cache, 'no-store');
    const path = new URL(String(url));
    if (path.pathname.includes('/products/handle/')) return Response.json(product);
    const n = Number(path.searchParams.get('page'));
    return Response.json(page(n === 1 ? [{ ...card, id: 2, handle: 'synthetic-other' }] : [{ ...card, images: ['one.jpg'], price: 999 }], n, 101, 100));
  };
  const item = await getProductWithVariants('synthetic', undefined, true);
  assert.equal(calls, 3); assert.deepEqual(item!.images, product.images); assert.equal(item!.description, product.description);
  assert.equal(selectedVariant(item!, 'L', 'Red')!.price, 12.35);
});
test('missing exact product does not fall back to a similarly named catalogue hit', async () => {
  globalThis.fetch = async (url) => Response.json(String(url).includes('/products/handle/') ? product : page([{ ...card, id: 2 }]));
  await assert.rejects(getProductWithVariants('synthetic'));
});
test('cards do not replace descriptions in the detail cache', () => {
  const qc = client(); qc.setQueryData(['product', product.handle], product);
  qc.setQueryData(catalogueQuery().queryKey, page([card]));
  assert.equal((qc.getQueryData(['product', product.handle]) as Product).description, 'Full description');
  assert.equal(cardAsProduct(card).description, '');
});
test('variant resolution rejects nonexistent, ambiguous, missing and third-option selections', () => {
  assert.equal(selectedVariant(product, 'M', 'Red'), undefined);
  assert.equal(selectedVariant(product), undefined);
  assert.equal(selectedVariant({ ...product, variants: undefined }, 'M', 'Blue'), undefined);
  assert.equal(selectedVariant({ ...product, variants: [product.variants![0], { ...product.variants![0], id: 99 }] }, 'M', 'Blue'), undefined);
  assert.equal(selectedVariant({ ...product, variants: [{ ...product.variants![0], option3: 'Extra' }] }, 'M', 'Blue'), undefined);
  assert.equal(variantProduct(product, selectedVariant(product, 'L', 'Red')!).price, 12.35);
});
test('exact stocks null/zero are unavailable and 999 stays a finite limit', async () => {
  for (const stock of [0, 999]) {
    const item = { ...product, variants: [{ ...product.variants![0], stock }] };
    const checked = await refreshCart([{ product: item, quantity: 1, selectedSize: 'M', selectedColor: 'Blue' }], undefined, async () => item);
    assert.equal(checked.errors.length > 0, stock === 0);
  }
  assert.equal(selectedVariant({ ...product, variants: [{ ...product.variants![0], stock: null as unknown as number }] }, 'M', 'Blue'), undefined);
});
test('cart validates each exact variant independently and aggregates identical lines', async () => {
  const m = { product, quantity: 1, selectedSize: 'M', selectedColor: 'Blue' };
  const l = { product: variantProduct(product, product.variants![1]), quantity: 3, selectedSize: 'L', selectedColor: 'Red' };
  const valid = await refreshCart([m, l], undefined, async () => product); assert.deepEqual(valid.errors, []);
  assert.equal(valid.items[1].product.price, 12.35);
  assert.match((await refreshCart([m, m], undefined, async () => product)).errors.join(), /quantità/);
  assert.match((await refreshCart([{ ...m, selectedColor: 'Red' }], undefined, async () => product)).errors.join(), /variante/);
});
test('freezes body and saves cryptographic key before preparing and token before submitting', async () => {
  let creation = 0;
  globalThis.fetch = async (url, init) => {
    const saved = loadCheckoutAttempt()!;
    assert.match(saved.key, /^[A-Za-z0-9_-]{16,128}$/);
    if (String(url).endsWith('/prepare')) { assert.equal(saved.calls, 0); return Response.json({ accessToken: token, expiresAt: new Date(Date.now() + 900000).toISOString() }); }
    creation++; assert.equal(saved.token, token); assert.equal(saved.state, 'submitted');
    const headers = new Headers(init!.headers); assert.equal(headers.get('Idempotency-Key'), saved.key); assert.equal(headers.get('Order-Access-Token'), token);
    assert.equal(init!.cache, 'no-store'); assert.equal(init!.referrerPolicy, 'no-referrer');
    assert.equal(JSON.parse(String(init!.body)).customerName, 'Synthetic'); assert.ok(!String(url).includes(token));
    return Response.json(result);
  };
  const mutable = structuredClone(body); newCheckoutAttempt(mutable); mutable.customerName = 'Changed'; mutable.items[0].quantity = 2;
  assert.deepEqual(await resumeCheckoutAttempt(), result); assert.equal(creation, 1); assert.equal(orderAccessToken(result.orderId), token);
});
test('lost response and timeout retry the identical body, key and token after a reload', async () => {
  const requests: { body: unknown; key: string | null; token: string | null }[] = [];
  api((init) => {
    const headers = new Headers(init.headers);
    requests.push({ body: init.body, key: headers.get('Idempotency-Key'), token: headers.get('Order-Access-Token') });
    if (requests.length === 1) throw new RequestTimeoutError(); return Response.json(result);
  });
  newCheckoutAttempt(body); await assert.rejects(resumeCheckoutAttempt(), RequestTimeoutError);
  const serialized = JSON.stringify(loadCheckoutAttempt());
  // Reads reconstruct solely from persisted storage; no mutable cart/form enters retry.
  assert.equal(JSON.stringify(loadCheckoutAttempt()), serialized);
  assert.deepEqual(await resumeCheckoutAttempt(), result); assert.deepEqual(requests[0], requests[1]);
  await resumeCheckoutAttempt(); assert.equal(requests.length, 2);
});
test('concurrent clicks share one preparation and one order submission', async () => {
  let calls = 0; api(async () => { calls++; await pause(); return Response.json(result); });
  newCheckoutAttempt(body); const a = resumeCheckoutAttempt(), b = resumeCheckoutAttempt();
  assert.equal(a, b); await Promise.all([a, b]); assert.equal(calls, 1);
});
test('uncertain submitted tokens are never renewed after their preparation deadline', async () => {
  let prepares = 0, creates = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/prepare')) { prepares++; return Response.json({ accessToken: token, expiresAt: new Date(Date.now() + 10000).toISOString() }); }
    creates++; if (creates === 1) throw new TypeError('lost'); return Response.json(result);
  };
  newCheckoutAttempt(body); await assert.rejects(resumeCheckoutAttempt());
  const saved = loadCheckoutAttempt()!; saved.prepareExpiresAt = new Date(0).toISOString(); sessionStorage.setItem('magic-city-drip-checkout-pending', JSON.stringify(saved));
  await resumeCheckoutAttempt(); assert.equal(prepares, 1); assert.equal(creates, 2);
});
test('preparation loss creates no order and can safely prepare again with the same frozen key', async () => {
  let prepares = 0, creates = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/prepare')) { if (++prepares === 1) throw new RequestTimeoutError(); return Response.json({ accessToken: token, expiresAt: new Date(Date.now() + 900000).toISOString() }); }
    creates++; return Response.json(result);
  };
  const first = newCheckoutAttempt(body); await assert.rejects(resumeCheckoutAttempt()); assert.equal(creates, 0);
  await resumeCheckoutAttempt(); assert.equal(loadCheckoutAttempt()!.key, first.key); assert.equal(creates, 1);
});
test('persistent storage failure blocks creation before any network call', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json(result); };
  globalThis.sessionStorage = { ...storage, setItem: () => { throw new Error('Disabled'); } };
  assert.throws(() => newCheckoutAttempt(body)); assert.equal(calls, 0);
});
test('failure saving prepared token never submits an order', async () => {
  let creates = 0; newCheckoutAttempt(body);
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/prepare')) {
      globalThis.sessionStorage = { ...storage, setItem: () => { throw new Error('Disabled'); } };
      return Response.json({ accessToken: token, expiresAt: new Date(Date.now() + 900000).toISOString() });
    }
    creates++; return Response.json(result);
  };
  await assert.rejects(resumeCheckoutAttempt()); assert.equal(creates, 0);
});
test('failure saving successful response replays the same submission rather than creating a new attempt', async () => {
  let calls = 0;
  api(() => { if (++calls === 1) globalThis.sessionStorage = { ...storage, setItem: () => { throw new Error('Disabled'); } }; return Response.json(result); });
  const original = newCheckoutAttempt(body); await assert.rejects(resumeCheckoutAttempt());
  globalThis.sessionStorage = storage; assert.equal(loadCheckoutAttempt()!.state, 'submitted');
  await resumeCheckoutAttempt(); assert.equal(loadCheckoutAttempt()!.key, original.key); assert.equal(calls, 2);
});
for (const [status, code] of [[409, 'IDEMPOTENCY_CONFLICT'], [410, 'IDEMPOTENCY_EXPIRED'], [401, 'ORDER_ACCESS_DENIED']] as const) {
  test(`${code} blocks retries and never rotates credentials`, async () => {
    let calls = 0; api(() => { calls++; return rejectCode(status, code); }); const original = newCheckoutAttempt(body);
    await assert.rejects(resumeCheckoutAttempt(), (error: HttpError) => error.code === code);
    assert.equal(loadCheckoutAttempt()!.state, 'blocked'); assert.equal(loadCheckoutAttempt()!.key, original.key);
    await assert.rejects(resumeCheckoutAttempt()); assert.throws(() => newCheckoutAttempt(body)); assert.equal(calls, 1);
  });
}
for (const code of ['VARIANT_OUT_OF_STOCK', 'DISCOUNT_UNAVAILABLE']) {
  test(`${code} reports definitive pre-creation rejection and permits explicitly corrected data`, async () => {
    api(() => rejectCode(409, code)); newCheckoutAttempt(body);
    await assert.rejects(resumeCheckoutAttempt(), (error: HttpError) => error.code === code);
    assert.equal(loadCheckoutAttempt()!.state, 'rejected'); const previous = loadCheckoutAttempt()!.key;
    assert.notEqual(newCheckoutAttempt({ ...body, discountCode: 'CORRECTED' }).key, previous);
  });
}
test('technical errors and rate limits preserve attempt and have a bounded retry budget', async () => {
  let calls = 0; api(() => { calls++; return rejectCode(503, 'IDEMPOTENCY_RETRY'); }); newCheckoutAttempt(body);
  for (let i = 0; i < 4; i++) await assert.rejects(resumeCheckoutAttempt());
  await assert.rejects(resumeCheckoutAttempt()); assert.equal(calls, 4); assert.equal(loadCheckoutAttempt()!.state, 'submitted');
  assert.match(checkoutErrorMessage(new HttpError(429, 'ORDER_ACCESS_RATE_LIMIT')), /minuto/);
});
test('legacy pending marker blocks instead of silently rotating an unknown order', async () => {
  markCheckoutPending(); assert.throws(() => newCheckoutAttempt(body)); await assert.rejects(resumeCheckoutAttempt());
});
test('two legitimate distinct purchases use distinct keys with no silent replacement', async () => {
  api(() => Response.json(result)); const a = newCheckoutAttempt(body); await resumeCheckoutAttempt();
  assert.throws(() => newCheckoutAttempt(body)); startDistinctPurchase(); const b = newCheckoutAttempt(body); await resumeCheckoutAttempt();
  assert.notEqual(a.key, b.key);
});
test('minimal paid check uses scoped access header and never an anonymous fallback', async () => {
  let calls = 0, paid = 0; api(() => Response.json(result)); newCheckoutAttempt(body); await resumeCheckoutAttempt();
  globalThis.fetch = async (url, init) => { calls++; assert.ok(String(url).endsWith('/orders/synthetic-order/min'));
    assert.equal(new Headers(init!.headers).get('Order-Access-Token'), token); return Response.json({ id: result.orderId, paymentStatus: 'PAID' }); };
  let stop = startPaidOrderCheck({ orderId: result.orderId, currentOrderId: () => result.orderId, onPaid: () => paid++ });
  await pause(); stop(); assert.equal(paid, 1); assert.equal(calls, 1);
  stop = startPaidOrderCheck({ orderId: 'other', currentOrderId: () => 'other', onPaid: () => assert.fail() });
  await pause(); stop(); assert.equal(calls, 1);
});
test('error bodies never expose arbitrary backend messages or token values', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Secret ' + token, accessToken: token }, { status: 401 });
  await assert.rejects(requestJSON('https://test.invalid'), (error: HttpError) => { assert.equal(error.code, undefined); assert.ok(!String(error).includes(token)); return true; });
});
test('wishlist with options navigates to exact selection without a silent default variant', async () => {
  localStorage.setItem('magic-city-drip-wishlist', JSON.stringify([product]));
  act(() => { renderer = create(<MemoryRouter><CartProvider><WishlistProvider><Wishlist /></WishlistProvider></CartProvider></MemoryRouter>); });
  const button = renderer!.root.findAllByType('button').find((item) => item.children.includes('Scegli le opzioni'))!;
  assert.ok(button); act(() => button.props.onClick());
  assert.equal(JSON.parse(localStorage.getItem('magic-city-drip-cart')!).length, 0);
});
test('cart context prices option changes exactly, sums cents and enforces known variant stock', () => {
  let cart!: ReturnType<typeof useCart>;
  function Capture() { cart = useCart(); return null; }
  act(() => { renderer = create(<CartProvider><Capture /></CartProvider>); });
  act(() => cart.addToCart(product, 1, 'M', 'Blue'));
  assert.equal(cart.getCartTotal(), 10);
  act(() => cart.addToCart(product, 1, 'M', 'Blue')); assert.equal(cart.items[0].quantity, 1);
  act(() => cart.updateOptions(1, 'M', 'Blue', 'L', 'Red'));
  assert.equal(cart.items[0].product.price, 12.35); assert.equal(cart.getCartTotal(), 12.35);
  act(() => cart.updateQuantity(1, 3, 'L', 'Red')); assert.equal(cart.getCartTotal(), 37.05);
  act(() => cart.updateQuantity(1, 4, 'L', 'Red')); assert.equal(cart.items[0].quantity, 3);
  act(() => cart.addToCart(product, 1, 'M', 'Red')); assert.equal(cart.items.length, 1);
});
test('generic 400 after an uncertain submission cannot authorize a fresh key', async () => {
  let calls = 0;
  api(() => { if (++calls === 1) throw new TypeError('lost'); return rejectCode(400, 'INVALID_DATA'); });
  newCheckoutAttempt(body); await assert.rejects(resumeCheckoutAttempt()); await assert.rejects(resumeCheckoutAttempt());
  assert.equal(loadCheckoutAttempt()!.state, 'blocked'); assert.throws(() => newCheckoutAttempt(body));
});
test('preparation retries are bounded and never create an order on failure', async () => {
  let calls = 0;
  globalThis.fetch = async (url) => { assert.ok(String(url).endsWith('/prepare')); calls++; throw new RequestTimeoutError(); };
  newCheckoutAttempt(body);
  for (let i = 0; i < 4; i++) await assert.rejects(resumeCheckoutAttempt());
  assert.equal(calls, 3); assert.equal(loadCheckoutAttempt()!.calls, 0);
});
test('invalid and expired prepared tokens never authorize an order submission', async () => {
  for (const accessToken of ['invalid', token]) {
    values.clear(); let calls = 0;
    globalThis.fetch = async (url) => { calls++; assert.ok(String(url).endsWith('/prepare'));
      return Response.json({ accessToken, expiresAt: new Date(0).toISOString() }); };
    newCheckoutAttempt(body); await assert.rejects(resumeCheckoutAttempt()); assert.equal(calls, 1);
  }
});
test('unsubmitted expired preparation can renew without replacing its key or body', async () => {
  const original = newCheckoutAttempt(body);
  sessionStorage.setItem('magic-city-drip-checkout-pending', JSON.stringify({ ...original, state: 'prepared', token: 'E'.repeat(43), prepareExpiresAt: new Date(0).toISOString() }));
  api((init) => { assert.equal(new Headers(init.headers).get('Order-Access-Token'), token); return Response.json(result); });
  await resumeCheckoutAttempt(); assert.equal(loadCheckoutAttempt()!.key, original.key);
});
test('missing credentials report a verified recovery requirement without deleting cart', async () => {
  let required = 0, calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No anonymous request permitted'); };
  const stop = startPaidOrderCheck({ orderId: 'legacy', currentOrderId: () => 'legacy', onPaid: () => assert.fail(), onAccessRequired: () => required++ });
  await pause(); stop(); assert.equal(required, 1); assert.equal(calls, 0);
});
test('collection filter is paginated and technical failures leave a retryable local state', async () => {
  let failed = true;
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)); assert.equal(path.searchParams.get('collection'), 'test');
    if (failed) return rejectCode(503, 'CATALOGUE_RETRY'); return Response.json(page([card]));
  };
  const qc = client(); const options = { ...catalogueQuery({ collection: 'test' }), retry: false };
  await assert.rejects(qc.fetchQuery(options)); assert.equal(qc.getQueryState(options.queryKey)?.fetchStatus, 'idle');
  failed = false; assert.equal((await qc.fetchQuery(options)).items[0].id, 1);
});
test('authoritative changed order total requires approval without changing the frozen request', async () => {
  api(() => Response.json(result)); newCheckoutAttempt(body, 10); await resumeCheckoutAttempt();
  const saved = loadCheckoutAttempt()!;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith('/orders/synthetic-order/min'));
    assert.equal(new Headers(init!.headers).get('Order-Access-Token'), token);
    return Response.json({ total: 12.35, currency: 'EUR', paymentStatus: 'PENDING' });
  };
  assert.equal(await checkCheckoutTotal(), 12.35); confirmCheckoutTotal(12.35); assert.equal(await checkCheckoutTotal(), null);
  assert.deepEqual(loadCheckoutAttempt()!.body, saved.body); assert.equal(loadCheckoutAttempt()!.key, saved.key); assert.equal(loadCheckoutAttempt()!.token, saved.token);
});
test('failed total verification and unsupported currency never authorize another order', async () => {
  api(() => Response.json(result)); newCheckoutAttempt(body, 10); await resumeCheckoutAttempt();
  globalThis.fetch = async () => { throw new RequestTimeoutError(); };
  await assert.rejects(checkCheckoutTotal()); assert.equal(loadCheckoutAttempt()!.state, 'success'); assert.throws(() => newCheckoutAttempt(body));
  globalThis.fetch = async () => Response.json({ total: 10, currency: 'USD' }); await assert.rejects(checkCheckoutTotal());
  globalThis.fetch = async () => Response.json({ total: 10, currency: 'EUR' }); assert.equal(await checkCheckoutTotal(), null);
});
async function mountSyntheticCart() {
  localStorage.setItem('magic-city-drip-cart', JSON.stringify([{ product: variantProduct(product, product.variants![0]), quantity: 1, selectedSize: 'M', selectedColor: 'Blue' }]));
  act(() => { renderer = create(<MemoryRouter><QueryClientProvider client={client()}><CartProvider><Cart /></CartProvider></QueryClientProvider></MemoryRouter>); });
  act(() => {
    renderer!.root.findAllByType('input').filter((input) => input.props.placeholder !== 'MAGIC00').forEach((input) => input.props.onChange({ target: { value: input.props.type === 'email' ? 'synthetic@example.invalid' : 'Synthetic' } }));
  });
}
test('cart UI holds redirect on a changed server total and approval resumes the same known order', async () => {
  let creates = 0;
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path.includes('/products/handle/')) return Response.json(product);
    if (path.endsWith('/catalog/products')) return Response.json(page([card], 1, 1, 100));
    if (path.endsWith('/prepare')) return Response.json({ accessToken: token, expiresAt: new Date(Date.now() + 900000).toISOString() });
    if (path.endsWith('/checkout/intent')) { creates++; return Response.json(result); }
    assert.ok(path.endsWith('/orders/synthetic-order/min')); return Response.json({ total: 12.35, currency: 'EUR', paymentStatus: 'PENDING' });
  };
  window.location.href = 'https://test.invalid'; await mountSyntheticCart();
  await act(async () => { await renderer!.root.findAllByType('button').find((button) => button.props.className?.includes('w-full mt-6'))!.props.onClick(); });
  assert.equal(creates, 1); assert.equal(window.location.href, 'https://test.invalid');
  assert.match(JSON.stringify(renderer!.toJSON()), /12.35/);
  const approval = renderer!.root.findAllByType('button').find((button) => String(button.children).includes('Conferma il totale'))!;
  assert.ok(approval);
  await act(async () => { approval.props.onClick(); await pause(); });
  assert.equal(window.location.href, 'https://test.invalid'); assert.ok(renderer!.root.findAllByType('a').some(a => String(a.props.href).includes('checkout-landing?orderId=synthetic-order'))); assert.equal(creates, 1);
});

test('saved attempt with an empty current cart remains visible and resumes its frozen order',async()=>{
 const snapshot={version:1,state:'success',key:'K'.repeat(24),token,body,calls:1,result};
 sessionStorage.setItem('magic-city-drip-checkout-pending',JSON.stringify(snapshot));let creates=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('/checkout/intent')){creates++;throw Error('No new order');}assert.ok(String(url).includes('/orders/synthetic-order/min'));return Response.json({id:result.orderId,total:10,currency:'EUR',paymentStatus:'PENDING'});};
 act(()=>{renderer=create(<MemoryRouter><QueryClientProvider client={client()}><CartProvider><Cart/></CartProvider></QueryClientProvider></MemoryRouter>);});
 assert.match(JSON.stringify(renderer!.toJSON()),/Il tuo ordine/);
 await act(async()=>{await renderer!.root.findAllByType('button').find(b=>b.props.className?.includes('w-full mt-6'))!.props.onClick();});
 assert.equal(creates,0);assert.equal(loadCheckoutAttempt()!.result!.orderId,result.orderId);assert.deepEqual(loadCheckoutAttempt()!.body,body);assert.equal(loadCheckoutAttempt()!.key,snapshot.key);
});
