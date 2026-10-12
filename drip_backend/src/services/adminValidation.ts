import { ReservationError } from "./reservations";

export function validMoney(value: number) {
  return (
    Number.isFinite(value) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

export function adminId(value: unknown): number {
  const n =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 2147483647)
    throw new ReservationError(400, "INVALID_ID");
  return n;
}
export function collectionIds(value: unknown): number[] {
  if (!Array.isArray(value))
    throw new ReservationError(400, "INVALID_COLLECTION_IDS");
  return [...new Set(value.map(adminId))];
}
export function imageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ReservationError(400, "INVALID_IMAGES");
  return value.map((raw) => {
    if (typeof raw !== "string")
      throw new ReservationError(400, "INVALID_IMAGE_URL");
    try {
      const url = new URL(raw);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
      return raw.trim();
    } catch {
      throw new ReservationError(400, "INVALID_IMAGE_URL");
    }
  });
}
export function productInput(body: Record<string, unknown>, create = false) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ReservationError(400, "INVALID_PRODUCT");
  for (const field of ["title", "handle"]) {
    if (
      (create || body[field] !== undefined) &&
      (typeof body[field] !== "string" || !(body[field] as string).trim())
    )
      throw new ReservationError(400, "INVALID_PRODUCT");
  }
  for (const field of [
    "vendor",
    "descriptionHtml",
    "productType",
    "status",
    "option1Name",
    "option2Name",
    "option3Name",
    "option1",
    "option2",
    "option3",
    "sku",
  ]) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    )
      throw new ReservationError(400, "INVALID_PRODUCT");
  }
  if (
    body.status != null &&
    !["active", "draft", "archived"].includes(String(body.status))
  )
    throw new ReservationError(400, "INVALID_PRODUCT_STATUS");
  if (
    body.tags !== undefined &&
    (!Array.isArray(body.tags) || body.tags.some((x) => typeof x !== "string"))
  )
    throw new ReservationError(400, "INVALID_TAGS");
  if (body.images !== undefined) imageUrls(body.images);
  if (body.collectionIds !== undefined) collectionIds(body.collectionIds);
  if (
    body.price !== undefined &&
    (typeof body.price !== "number" || !validMoney(body.price))
  )
    throw new ReservationError(400, "INVALID_PRICE");
  if (
    body.compareAtPrice != null &&
    (typeof body.compareAtPrice !== "number" ||
      !validMoney(body.compareAtPrice) ||
      body.compareAtPrice < 0 ||
      body.compareAtPrice > 99999999.99)
  )
    throw new ReservationError(400, "INVALID_PRICE");
}
export function discountInput(body: Record<string, unknown>, create = false) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ReservationError(400, "INVALID_DISCOUNT");
  if (create && (typeof body.code !== "string" || !body.code.trim()))
    throw new ReservationError(400, "INVALID_DISCOUNT_CODE");
  if (
    (create || body.type !== undefined) &&
    !["percentage", "fixed"].includes(String(body.type))
  )
    throw new ReservationError(400, "INVALID_DISCOUNT_TYPE");
  if (
    (create || body.value !== undefined) &&
    (typeof body.value !== "number" ||
      !validMoney(body.value) ||
      body.value <= 0 ||
      body.value > 99999999.99 ||
      (body.type === "percentage" && body.value > 100))
  )
    throw new ReservationError(400, "INVALID_DISCOUNT_VALUE");
  if (
    body.usageLimit != null &&
    (typeof body.usageLimit !== "number" ||
      !Number.isInteger(body.usageLimit) ||
      body.usageLimit < 0 ||
      body.usageLimit > 2147483647)
  )
    throw new ReservationError(400, "INVALID_USAGE_LIMIT");
  if (
    body.expiresAt != null &&
    (typeof body.expiresAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.expiresAt) ||
      !Number.isFinite(Date.parse(body.expiresAt)))
  )
    throw new ReservationError(400, "INVALID_EXPIRATION");
  if (body.active !== undefined && typeof body.active !== "boolean")
    throw new ReservationError(400, "INVALID_DISCOUNT");
}
