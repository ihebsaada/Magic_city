const configured = import.meta.env.VITE_BASE_API_URL;
export const BASE_API_URL = (
  configured || (import.meta.env.PROD ? "" : "http://localhost:4000/api")
).replace(/\/$/, "");
if (
  !BASE_API_URL ||
  (import.meta.env.PROD && !/^https:\/\/[^/]+\/api$/.test(BASE_API_URL))
)
  throw new Error(
    "Configure VITE_BASE_API_URL with an HTTPS API URL ending in /api.",
  );
export const SESSION_EVENT = "admin-session-changed";
const messages: Record<string, string> = {
  STOCK_BELOW_RESERVATIONS:
    "Physical stock cannot be lower than reserved stock. Reload the product before adjusting it.",
  PRODUCT_HAS_RESERVATION_HISTORY:
    "This product has reservation history. Archive it instead of deleting it.",
  PRODUCT_HAS_ORDER_HISTORY:
    "This product belongs to an order. Archive it instead of deleting it.",
  DISCOUNT_HAS_RESERVATION_HISTORY:
    "This discount has reservation history. Deactivate it instead of deleting it.",
  DISCOUNT_LIMIT_BELOW_RESERVATIONS:
    "The limit cannot be lower than consumed and reserved uses.",
  HISTORICAL_ORDER_READ_ONLY:
    "Historical orders are read-only and cannot be changed.",
  ORDER_STATE_REGRESSION:
    "This order transition is not allowed. Reload the order.",
  PAYMENT_STATE_REGRESSION: "This payment transition is not allowed.",
  LEGACY_RESERVATION_REVIEW:
    "This order requires reservation review before changing its payment status.",
  DUPLICATE_VALUE: "This handle, SKU or discount code already exists.",
  ORIGIN_DENIED: "The server does not authorize this Admin origin.",
  INVALID_STOCK: "Stock must be a non-negative whole number.",
  INVALID_PRICE:
    "Enter a valid amount in EUR, with at most two decimal places.",
  COLLECTION_NOT_FOUND:
    "A selected collection no longer exists. Reload before saving.",
  INVALID_IMAGE_URL:
    "Use a valid HTTP or HTTPS image URL without embedded credentials.",
  INVALID_DISCOUNT_VALUE:
    "Enter a positive amount with at most two decimals; percentages cannot exceed 100.",
  INVALID_USAGE_LIMIT: "The usage limit must be a non-negative whole number.",
  INVALID_EXPIRATION: "Enter a valid expiration date and time.",
  VARIANT_NOT_FOUND: "This variant no longer exists. Reload the product.",
};
const statuses: Record<number, string> = {
  400: "Check the submitted values.",
  401: "Your session has expired. Sign in again.",
  403: "This operation is not authorized.",
  404: "The requested record no longer exists.",
  409: "The operation conflicts with the current record. Reload before retrying.",
  422: "Some submitted values are invalid.",
  429: "Too many requests. Wait before trying again.",
  500: "The server could not complete the operation.",
  503: "The service is temporarily unavailable.",
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(
      message ||
        messages[code] ||
        statuses[status] ||
        "The request could not be completed.",
    );
    this.name = "ApiError";
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}
export function clearSession() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export function tokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")),
    );
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}
export async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  authenticated = true,
): Promise<T> {
  const token = authenticated ? localStorage.getItem("admin_token") : null;
  if (authenticated && (!token || (tokenExpiry(token) ?? 0) <= Date.now())) {
    clearSession();
    throw new ApiError(401, "SESSION_EXPIRED");
  }
  let response: Response;
  try {
    response = await fetch(`${BASE_API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Unable to reach the API. Check your connection and the server origin configuration. The operation was not retried; reload before resubmitting.",
    );
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  let data: unknown = null;
  let parsed = true;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    parsed = false;
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      authenticated &&
      localStorage.getItem("admin_token") === token
    )
      clearSession();
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "HTTP_ERROR";
    throw new ApiError(
      response.status,
      code,
      !authenticated && response.status === 401
        ? "Incorrect email or password."
        : undefined,
    );
  }
  if (!parsed)
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "The server returned an invalid response. Reload before resubmitting.",
    );
  return data as T;
}
export const apiGet = <T>(path: string) => request<T>(path, "GET");
export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, "POST", body);
export const apiPut = <T>(path: string, body: unknown) =>
  request<T>(path, "PUT", body);
export const apiPatch = <T>(path: string, body: unknown) =>
  request<T>(path, "PATCH", body);
export const apiDelete = <T>(path: string) => request<T>(path, "DELETE");
