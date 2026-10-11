export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number; cache?: RequestCache; headers?: Record<string, string> };

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code?: string) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

export class RequestTimeoutError extends Error {
  constructor() {
    super("La richiesta ha impiegato troppo tempo. Riprova.");
    this.name = "RequestTimeoutError";
  }
}

// The deadline covers both response headers and body consumption.
export async function requestJSON<T>(
  url: string,
  init: RequestInit = {},
  { signal, timeoutMs = 30_000, cache, headers }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const mergedHeaders = new Headers(init.headers);
    Object.entries(headers ?? {}).forEach(([name, value]) => mergedHeaders.set(name, value));
    const response = await fetch(url, { ...init, headers: mergedHeaders, referrerPolicy: 'no-referrer', ...(cache ? { cache } : {}), signal: controller.signal });
    if (!response.ok) {
      // Retain only machine codes, never arbitrary error bodies or credentials.
      const body = await response.json().catch(() => null) as { error?: unknown } | null;
      const code = typeof body?.error === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(body.error) ? body.error : undefined;
      throw new HttpError(response.status, code);
    }
    return await response.json() as T;
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
