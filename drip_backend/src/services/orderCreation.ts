import {shippingAmount} from './shipping';
import { Prisma } from "@prisma/client";

import {ReservationError} from "./reservations";
import { OrderInputError, normalizeCode, money, MAX_AMOUNT, priceDiscount } from "./orderPricing";

const LIMITS = { lines: 100, quantity: 99, totalQuantity: 1000, productId: 2147483647 };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderInputError("Invalid request data");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new OrderInputError("Invalid text field");
  const result = value.trim();
  if (!result && required) throw new OrderInputError("Missing required field");
  return result || undefined;
}
export function validateOrderInput(value: unknown) {
  const body = object(value);
  const customerName = text(body.customerName, 200, true)!;
  const customerEmail = text(body.customerEmail, 254, true)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new OrderInputError("Invalid email");
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > LIMITS.lines) throw new OrderInputError("Invalid items");
  let totalQuantity = 0;
  const items = body.items.map((raw) => {
    const item = object(raw);
    const { productId, quantity } = item;
    if (typeof productId !== "number" || !Number.isInteger(productId) || productId <= 0 || productId > LIMITS.productId) throw new OrderInputError("Invalid product id");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0 || quantity > LIMITS.quantity) throw new OrderInputError("Invalid quantity");
    totalQuantity += quantity;
    return { productId, quantity, selectedSize: text(item.selectedSize, 100), selectedColor: text(item.selectedColor, 100) };
  });
  if (totalQuantity > LIMITS.totalQuantity) throw new OrderInputError("Too many units");
  const shipping: Record<string, string | undefined> = {};
  if (body.shipping !== undefined) {
    const raw = object(body.shipping);
    for (const [key, max] of Object.entries({ name:200, phone:40, address1:300, address2:300, city:100, zip:32, state:100, country:100 })) shipping[key] = text(raw[key], max);
  }
  return { customerName, customerEmail, items, shipping, discountCode: normalizeCode(body.discountCode) };
}
export async function prepareOrder(value: unknown, db: Prisma.TransactionClient, shippingEnabled=false): Promise<{data:Prisma.OrderCreateInput;quantities:Map<number,number>}> {
  const input = validateOrderInput(value);
  const ids=[...new Set(input.items.map(i=>i.productId))].sort((a,b)=>a-b);
  for(const id of ids) await db.$queryRawUnsafe('SELECT "id" FROM "Product" WHERE "id"=$1 FOR UPDATE',id);
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(input.items.map(i => i.productId))] } },
    include: { images: true, variants: true },
  });
  const productsById = new Map(products.map(p => [p.id, p]));
  const quantities = new Map<number, number>();
  let subtotal = money(0);
  const orderItems = input.items.map(item => {
    const product = productsById.get(item.productId);
    if (!product) throw new OrderInputError("Product not found");
    const matches = product.variants.filter(v =>
      (!item.selectedSize || v.option1 === item.selectedSize) &&
      (!item.selectedColor || v.option2 === item.selectedColor));
    if (matches.length !== 1 || matches[0].option3) throw new OrderInputError("Variant missing, ambiguous or unsupported");
    const variant = matches[0];
    const key = variant.id;
    const quantity = (quantities.get(key) ?? 0) + item.quantity;
    if (quantity > LIMITS.quantity) throw new OrderInputError("Too many units of one variant");
    quantities.set(key, quantity);
    if (!variant.price || !variant.price.isFinite() || variant.price.lte(0)) throw new OrderInputError("Invalid product price");
    const unitPrice = money(variant.price);
    if (unitPrice.lte(0)) throw new OrderInputError("Invalid product price");
    subtotal = subtotal.plus(unitPrice.mul(item.quantity));
    if (subtotal.gt(MAX_AMOUNT)) throw new OrderInputError("Order amount exceeds limit");
    return { productId: product.id, productTitle: product.title, productHandle: product.handle,
      mainImage: product.images[0]?.src ?? null, quantity: item.quantity, unitPrice,
      selectedSize: variant.option1 ?? null, selectedColor: variant.option2 ?? null, variantSku: variant.sku ?? null };
  });
  for(const id of [...quantities.keys()].sort((a,b)=>a-b))
    await db.$queryRawUnsafe('SELECT "id" FROM "Variant" WHERE "id"=$1 FOR UPDATE',id);
  if(input.discountCode) {
    await db.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "code"=$1 FOR UPDATE',input.discountCode);
    const rule=await db.discount.findUnique({where:{code:input.discountCode}});
    if(rule?.usageLimit!=null && rule.usageCount+rule.reservedUses>=rule.usageLimit)
      throw new ReservationError(409,"DISCOUNT_UNAVAILABLE");
  }
  const pricing = await priceDiscount(money(subtotal), input.discountCode, db);
  const finalTotal=pricing.total.plus(shippingAmount(subtotal,shippingEnabled));
  if(finalTotal.gt(MAX_AMOUNT))throw new OrderInputError("Order amount exceeds limit");
  const s = input.shipping;
  return {quantities,data:{ customerName: input.customerName, customerEmail: input.customerEmail,
    currency: (process.env.STRIPE_CURRENCY || "eur").toUpperCase(),
    total: finalTotal, originalTotal: pricing.originalTotal, discountAmount: pricing.discountAmount, discountCode: pricing.appliedCode,
    shippingName: s.name ?? input.customerName, shippingPhone: s.phone ?? null, shippingAddress1: s.address1 ?? null,
    shippingAddress2: s.address2 ?? null, shippingCity: s.city ?? null, shippingZip: s.zip ?? null,
    shippingState: s.state ?? null, shippingCountry: s.country ?? null,
    status: "PENDING", paymentStatus: "PENDING", items: { create: orderItems } }};
}
