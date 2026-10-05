import {accessHash,bindGuestAccess,authorizeGuestAccess} from "./guestOrderAccess";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../prisma";
import { prepareOrder, validateOrderInput } from "./orderCreation";
import {reserveOrder} from "./reservations";
import { OrderInputError } from "./orderPricing";

export class IdempotencyError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
const REPLAY_MS = 30 * 24 * 60 * 60 * 1000;
type Endpoint = "intent" | "orders";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function parseIdempotencyKey(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new OrderInputError("Invalid Idempotency-Key");
  return value;
}
export function requestFingerprint(value: unknown, endpoint: Endpoint): string {
  const input = validateOrderInput(value);
  const lines = new Map<string, number>();
  for (const item of input.items) {
    const key = JSON.stringify([item.productId, item.selectedSize ?? null, item.selectedColor ?? null]);
    lines.set(key, (lines.get(key) ?? 0) + item.quantity);
  }
  return hash(JSON.stringify({ version: 1, endpoint, customerName: input.customerName, customerEmail: input.customerEmail,
    discountCode: input.discountCode, shipping: input.shipping,
    items: [...lines].sort(([a], [b]) => a.localeCompare(b, "en")) }));
}
const snapshot = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function replay(record: { requestHash: string; replayUntil: Date; response: Prisma.JsonValue; statusCode: number }, fingerprint: string) {
  if (record.requestHash !== fingerprint) throw new IdempotencyError(409, "IDEMPOTENCY_CONFLICT");
  // Never silently create a second order after expiration. Key tombstones are retained.
  if (record.replayUntil.getTime() <= Date.now()) throw new IdempotencyError(410, "IDEMPOTENCY_EXPIRED");
  if (record.response === null) throw new IdempotencyError(503, "IDEMPOTENCY_RETRY");
  return { response: record.response, status: record.statusCode, replayed: true };
}

async function create(db: Prisma.TransactionClient, value: unknown, endpoint: Endpoint, tokenHash?:string) {
 const {data,quantities}=await prepareOrder(value,db);
 const order=await db.order.create({data,include:{items:true}});
 await reserveOrder(db,order.id,quantities,data.discountCode as string|null);
 if(tokenHash)await bindGuestAccess(db,tokenHash,order.id);
 if(endpoint==="intent")return {orderId:order.id,redirectUrl:(process.env.CHECKOUT_APP_URL||"http://localhost:5173")+"/checkout-landing?orderId="+order.id};
 return order;
}
export async function createIdempotentOrder(value: unknown, endpoint: Endpoint, header: unknown, accessToken?:unknown) {
  const tokenHash=accessToken===undefined?undefined:accessHash(accessToken);
  const key = parseIdempotencyKey(header);
  if (!key) return { response: await prisma.$transaction(tx=>create(tx,value,endpoint,tokenHash),{maxWait:5000,timeout:10000}), status: 201, replayed: false };
  const keyHash = hash(key);
  const baseFingerprint = requestFingerprint(value, endpoint);
  const fingerprint=tokenHash?hash(baseFingerprint+":"+tokenHash):baseFingerprint;
  const previous = await prisma.orderIdempotency.findUnique({ where: { keyHash } });
  if (previous) {
    const result=replay(previous,fingerprint);
    if(tokenHash)await authorizeGuestAccess(previous.orderId!,accessToken);
    return result;
  }
  try {
    return await prisma.$transaction(async (tx) => {
      // The unique insert waits on a competing uncommitted insert; no process-local lock.
      await tx.orderIdempotency.create({ data: { keyHash, requestHash: fingerprint, endpoint, replayUntil: new Date(Date.now() + REPLAY_MS) } });
      const response = snapshot(await create(tx, value, endpoint,tokenHash));
      const orderId = (response as Record<string, Prisma.InputJsonValue>)[endpoint === "intent" ? "orderId" : "id"] as string;
      await tx.orderIdempotency.update({ where: { keyHash }, data: { orderId, response } });
      return { response, status: 201, replayed: false };
    }, { maxWait: 5_000, timeout: 10_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.orderIdempotency.findUnique({ where: { keyHash } });
      if (winner) {
        const result=replay(winner,fingerprint);
        if(tokenHash)await authorizeGuestAccess(winner.orderId!,accessToken);
        return result;
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2028", "P2034", "P1008"].includes(error.code)) {
      throw new IdempotencyError(503, "IDEMPOTENCY_RETRY");
    }
    throw error;
  }
}

// Explicit maintenance operation: never invoked automatically by application startup.
export async function purgeExpiredIdempotencyResponses(now = new Date()) {
  return prisma.orderIdempotency.updateMany({
    where: { replayUntil: { lte: now }, response: { not: Prisma.DbNull } },
    data: { response: Prisma.DbNull },
  });
}
