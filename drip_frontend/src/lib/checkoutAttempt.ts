import { checkoutPayload, prepareOrderAccess, submitCheckoutPayload, readOrderMinimal, type CheckoutPayload, type CheckoutIntentResponse } from '@/services/orderService';
import { HttpError } from '@/services/request';

const key = 'magic-city-drip-checkout-pending';
const accessKey = 'magic-city-drip-order-access';
export type CheckoutAttempt = {
  version: 1; key: string; body: CheckoutPayload; createdAt: string;
  checkoutMode?: 'common' | 'historical';
  token?: string; prepareExpiresAt?: string; calls: number; prepareCalls?: number;
  state: 'preparing' | 'prepared' | 'submitted' | 'success' | 'rejected' | 'blocked';
  result?: CheckoutIntentResponse;
  quotedTotal?: number; confirmedTotal?: number;
};
export class AttemptBlockedError extends Error {}
export function loadCheckoutAttempt(): CheckoutAttempt | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CheckoutAttempt;
    if (value.version !== 1 || !/^[A-Za-z0-9_-]{16,128}$/.test(value.key) ||
        (value.checkoutMode !== undefined && !['common', 'historical'].includes(value.checkoutMode)) ||
        !value.body || !Array.isArray(value.body.items) || !Number.isInteger(value.calls) || value.calls < 0 ||
        !['preparing','prepared','submitted','success','rejected','blocked'].includes(value.state) ||
        (value.token !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(value.token)) ||
        ((value.state === 'submitted' || value.state === 'success') && !value.token)) throw new Error();
    return value;
  } catch { throw new AttemptBlockedError('Tentativo precedente non recuperabile. Verifica con assistenza prima di creare un nuovo ordine.'); }
}
function save(attempt: CheckoutAttempt) {
  const raw = JSON.stringify(attempt);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw new AttemptBlockedError('Impossibile conservare il tentativo in modo sicuro.');
}
export function hasPendingCheckout() {
  try { const attempt = loadCheckoutAttempt(); return !!attempt && attempt.state !== 'rejected' && attempt.state !== 'success'; } catch { return true; }
}
// Retain the old guard API for legacy callers. Its unknown outcome must stay blocked.
export function markCheckoutPending() { sessionStorage.setItem(key, 'pending'); }
export function clearPendingCheckout() { sessionStorage.removeItem(key); }
export function newCheckoutAttempt(body: CheckoutPayload, quotedTotal?: number): CheckoutAttempt {
  const previous = loadCheckoutAttempt();
  if (previous && previous.state !== 'rejected') throw new AttemptBlockedError('Riprendi il tentativo esistente prima di un nuovo acquisto.');
  const attempt: CheckoutAttempt = { version: 1, key: crypto.randomUUID(),
    body: JSON.parse(JSON.stringify(body)) as CheckoutPayload, createdAt: new Date().toISOString(), calls: 0, prepareCalls: 0, state: 'preparing', quotedTotal,
    checkoutMode: import.meta.env.MODE === 'staging' && import.meta.env.DEV === true && import.meta.env.PROD === false &&
      import.meta.env.VITE_COMMON_CHECKOUT_ENABLED === 'true' && typeof window !== 'undefined' &&
      window.location.origin === 'http://127.0.0.1:5173' ? 'common' : 'historical' };
  save(attempt);
  return attempt;
}
export function startDistinctPurchase() {
  const attempt = loadCheckoutAttempt();
  if (attempt && !['success', 'rejected'].includes(attempt.state)) throw new AttemptBlockedError('Esito ancora incerto.');
  // Preserve access to a known order before replacing its attempt.
  if (attempt?.state === 'success') rememberAccess(attempt);
  clearPendingCheckout();
}
export function orderAccessToken(orderId: string): string | undefined {
  try {
    const attempt = loadCheckoutAttempt();
    if (attempt?.result?.orderId === orderId) return attempt.token;
    const saved = JSON.parse(sessionStorage.getItem(accessKey) ?? '{}') as Record<string, string>;
    return saved[orderId];
  } catch { return undefined; }
}
function rememberAccess(attempt: CheckoutAttempt) {
  if (!attempt.token || !attempt.result) return;
  const saved = JSON.parse(sessionStorage.getItem(accessKey) ?? '{}') as Record<string, string>;
  saved[attempt.result.orderId] = attempt.token;
  sessionStorage.setItem(accessKey, JSON.stringify(saved));
}
export async function checkCheckoutTotal(signal?: AbortSignal): Promise<number | null> {
  const attempt = loadCheckoutAttempt();
  if (!attempt?.token || !attempt.result || attempt.state !== 'success') throw new AttemptBlockedError('Ordine non verificabile.');
  const order = await readOrderMinimal(attempt.result.orderId, attempt.token, signal);
  if (!Number.isFinite(order.total) || order.total < 0 || order.currency?.toUpperCase() !== 'EUR') throw new AttemptBlockedError('Totale o valuta non validi. Verifica con assistenza.');
  if (attempt.quotedTotal !== undefined && Math.round(order.total * 100) !== Math.round(attempt.quotedTotal * 100) &&
      (attempt.confirmedTotal === undefined || Math.round(order.total * 100) !== Math.round(attempt.confirmedTotal * 100))) return order.total;
  return null;
}
export function confirmCheckoutTotal(total: number) {
  const attempt = loadCheckoutAttempt();
  if (!attempt || attempt.state !== 'success' || !Number.isFinite(total) || total < 0) throw new AttemptBlockedError('Conferma non valida.');
  attempt.confirmedTotal = total; save(attempt); // Approval never changes the request, key or token.
}
const definitelyRejected = (error: HttpError) => error.status === 400 ||
  (error.status === 409 && ['VARIANT_OUT_OF_STOCK', 'DISCOUNT_UNAVAILABLE'].includes(error.code ?? ''));

// No automatic POST retry. Explicit replays use the stored body, key and token.
let running: Promise<CheckoutIntentResponse> | undefined;
export function resumeCheckoutAttempt(): Promise<CheckoutIntentResponse> {
  if (running) return running;
  running = run().finally(() => { running = undefined; });
  return running;
}
async function run(): Promise<CheckoutIntentResponse> {
  const attempt = loadCheckoutAttempt();
  if (!attempt) throw new AttemptBlockedError('Nessun tentativo da riprendere.');
  if (attempt.state === 'success' && attempt.result) {
    try { rememberAccess(attempt); } catch { /* Credentials are already in the durable attempt. */ }
    return attempt.result;
  }
  if (attempt.state === 'blocked' || attempt.state === 'rejected') throw new AttemptBlockedError('Tentativo bloccato. Verifica lo stato prima di procedere.');
  if (attempt.calls >= 4) throw new AttemptBlockedError('Limite di riprese raggiunto. Verifica con assistenza; non creare un nuovo ordine.');
  if (!attempt.token || (attempt.calls === 0 && Date.parse(attempt.prepareExpiresAt ?? '') <= Date.now())) {
    // A preparation never creates an order. Only an unsubmitted attempt can prepare again.
    if (attempt.calls !== 0) throw new AttemptBlockedError('Credenziali del tentativo mancanti.');
    if ((attempt.prepareCalls ?? 0) >= 3) throw new AttemptBlockedError('Limite di preparazioni raggiunto. Verifica con assistenza prima di procedere.');
    attempt.prepareCalls = (attempt.prepareCalls ?? 0) + 1; save(attempt);
    const prepared = await prepareOrderAccess();
    if (!/^[A-Za-z0-9_-]{43}$/.test(prepared.accessToken) || !Number.isFinite(Date.parse(prepared.expiresAt)) ||
        Date.parse(prepared.expiresAt) <= Date.now()) throw new AttemptBlockedError('Preparazione accesso non valida.');
    attempt.token = prepared.accessToken; attempt.prepareExpiresAt = prepared.expiresAt;
    attempt.state = 'prepared'; save(attempt);
  }
  attempt.calls++; attempt.state = 'submitted'; save(attempt);
  try {
    const result = await submitCheckoutPayload(attempt.body, { headers: { 'Idempotency-Key': attempt.key, 'Order-Access-Token': attempt.token! } });
    if (!result || typeof result.orderId !== 'string' || !result.orderId || typeof result.redirectUrl !== 'string') throw new Error('Risposta ordine non valida.');
    const redirect = new URL(result.redirectUrl);
    if (!['https:', 'http:'].includes(redirect.protocol) || redirect.username || redirect.password ||
        /(?:accessToken|access_token|recoveryToken|token)=/i.test(redirect.search) || redirect.hash) throw new Error('Reindirizzamento non valido.');
    attempt.result = result; attempt.state = 'success'; save(attempt);
    try { rememberAccess(attempt); } catch { /* Retain credentials in the successful attempt. */ }
    return result;
  } catch (error) {
    if (error instanceof HttpError) {
      // After an uncertain submission, even a generic 400 cannot prove the first order absent.
      if (definitelyRejected(error) && !(error.status === 400 && attempt.calls > 1)) attempt.state = 'rejected';
      else if (error.status === 400) attempt.state = 'blocked';
      else if (error.status === 401 || error.status === 410 || error.code === 'IDEMPOTENCY_CONFLICT') attempt.state = 'blocked';
      save(attempt);
    }
    throw error;
  }
}
export function checkoutErrorMessage(error: unknown): string {
  if (error instanceof AttemptBlockedError) return error.message;
  if (error instanceof HttpError) {
    const messages: Record<string, string> = {
      VARIANT_OUT_OF_STOCK: 'Stock non disponibile. Aggiorna il carrello prima di confermare.',
      DISCOUNT_UNAVAILABLE: 'Codice sconto scaduto o esaurito. Modifica il codice e conferma nuovamente.',
      IDEMPOTENCY_CONFLICT: 'Conflitto del tentativo. Non creare un nuovo ordine; contatta assistenza.',
      IDEMPOTENCY_EXPIRED: 'Tentativo scaduto. Recupera e verifica la vecchia richiesta con assistenza.',
      ORDER_ACCESS_DENIED: 'Accesso non valido, scaduto o revocato. Serve un recupero verificato.',
      RESERVATION_EXPIRED: 'Prenotazione scaduta. Verifica lo stato della richiesta prima di procedere.',
      ORDER_ACCESS_RATE_LIMIT: 'Troppe richieste. Attendi almeno un minuto prima di riprendere.',
    };
    if (error.code && messages[error.code]) return messages[error.code];
    if (error.status === 400) return 'Dati rifiutati. Controlla cliente, indirizzo, quantità e variante. Dopo una risposta incerta verifica il vecchio tentativo con assistenza.';
  }
  return 'Risposta non disponibile. Riprendi lo stesso tentativo: dati, chiave e accesso saranno riutilizzati.';
}
export { checkoutPayload };
