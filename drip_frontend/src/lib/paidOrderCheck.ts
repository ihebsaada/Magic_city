import { apiGet } from "@/services/api";
import { HttpError } from "@/services/request";
import { orderAccessToken } from '@/lib/checkoutAttempt';

type Options = {
  orderId: string;
  currentOrderId: () => string | null;
  onPaid: () => void;
  onAccessRequired?: () => void;
  events?: Pick<Window, "addEventListener" | "removeEventListener">;
  read?: (id: string, signal: AbortSignal) => Promise<{ id: string; paymentStatus: string }>;
  retryDelayMs?: number;
  maxAttempts?: number;
};

// One bounded budget shared by scheduled retries and reconnection/focus events.
export function startPaidOrderCheck({ orderId, currentOrderId, onPaid, onAccessRequired, events,
  read = (id, signal) => {
    const token = orderAccessToken(id);
    // Missing credentials require verified recovery, never an anonymous fallback.
    if (!token) return Promise.reject(new HttpError(401, 'ORDER_ACCESS_DENIED'));
    return apiGet(`/orders/${encodeURIComponent(id)}/min`, { signal, cache: 'no-store', headers: { 'Order-Access-Token': token } });
  },
  retryDelayMs = 2_000, maxAttempts = 3,
}: Options) {
  const controller = new AbortController();
  let attempts = 0;
  let running = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    controller.abort();
    clearTimeout(timer);
    events?.removeEventListener("online", trigger);
    events?.removeEventListener("focus", trigger);
  };
  async function check() {
    if (stopped || running || attempts >= maxAttempts) return;
    if (currentOrderId() !== orderId) { stop(); return; }
    clearTimeout(timer);
    running = true;
    attempts++;
    try {
      const order = await read(orderId, controller.signal);
      if (!stopped && currentOrderId() === orderId && order.id === orderId && order.paymentStatus === "PAID") {
        onPaid();
        stop();
      }
    } catch (error) {
      if (!stopped && currentOrderId() === orderId && error instanceof HttpError && error.status === 401) onAccessRequired?.();
      if (error instanceof HttpError && error.status < 500) stop();
    } finally {
      running = false;
      if (!stopped && attempts < maxAttempts) timer = setTimeout(trigger, retryDelayMs);
      else stop();
    }
  }
  function trigger() { void check(); }
  events?.addEventListener("online", trigger);
  events?.addEventListener("focus", trigger);
  trigger();
  return stop;
}
