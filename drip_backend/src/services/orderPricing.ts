import { Prisma, Discount } from "@prisma/client";
import prisma from "../prisma";

export class OrderInputError extends Error {}
export const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const MAX_AMOUNT = new Prisma.Decimal("99999999.99");
export function normalizeCode(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 64 || /[\x00-\x1f\x7f]/.test(value)) throw new OrderInputError("Invalid discount code");
  return value.trim().toUpperCase();
}
export function validateSubtotal(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || new Prisma.Decimal(value).gt(MAX_AMOUNT)) {
    throw new OrderInputError("Invalid subtotal");
  }
  return money(value);
}
type Rule = Pick<Discount, "active" | "expiresAt" | "usageLimit" | "usageCount" | "type" | "value"> & {reservedUses?:number};
export function evaluateDiscount(subtotal: Prisma.Decimal, code: string, rule: Rule | null, now = new Date()) {
  let reason: "EMPTY" | "NOT_FOUND" | "INACTIVE" | "EXPIRED" | "LIMIT_REACHED" | "ERROR" | null = null;
  if (!code) reason = "EMPTY";
  else if (!rule) reason = "NOT_FOUND";
  else if (!rule.active) reason = "INACTIVE";
  else if (rule.expiresAt && rule.expiresAt.getTime() <= now.getTime()) reason = "EXPIRED";
  else if (rule.usageLimit != null && rule.usageCount+(rule.reservedUses??0) >= rule.usageLimit) reason = "LIMIT_REACHED";
  else if (!rule.value.isFinite() || rule.value.lte(0) || (rule.type === "PERCENTAGE" && rule.value.gt(100))) reason = "ERROR";
  let discountAmount = money(0);
  if (!reason && rule) {
    const raw = rule.type === "PERCENTAGE" ? subtotal.mul(rule.value).div(100) : rule.value;
    discountAmount = Prisma.Decimal.min(subtotal, money(raw));
  }
  return { originalTotal: subtotal, discountAmount, total: money(subtotal.minus(discountAmount)),
    appliedCode: reason ? null : code, valid: reason === null, reason };
}
export async function priceDiscount(subtotal: Prisma.Decimal, code: string, db: Pick<Prisma.TransactionClient, "discount"> = prisma) {
  const rule = code ? await db.discount.findUnique({ where: { code } }) : null;
  return evaluateDiscount(subtotal, code, rule);
}
// Prepared policy only. Not included in order.total until coordinated activation.
export function proposedShipping(subtotalBeforeDiscount: Prisma.Decimal) {
  return subtotalBeforeDiscount.gte("99.90") ? money(0) : money("9.90");
}
