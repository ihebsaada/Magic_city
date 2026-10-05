
import { randomUUID } from "node:crypto";
import { Order, PaymentAttempt, Prisma } from "@prisma/client";
import Stripe from "stripe";
import prisma from "../prisma";
import { stripe } from "./stripeClient";
import {consumeReservation,ReservationError,PAYMENT_WINDOW_MS} from "./reservations";
export class PaymentError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
const cents = (o: Order) => new Prisma.Decimal(o.total).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
const latest = (tx: Prisma.TransactionClient, orderId: string) =>
  tx.paymentAttempt.findFirst({where:{orderId},orderBy:{generation:"desc"}});
async function lockedOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id" = $1 FOR UPDATE', id);
  const order = await tx.order.findUnique({where:{id}});
  if (!order) throw new PaymentError(404,"ORDER_NOT_FOUND");
  return order;
}
function payable(o: Order) {
  if (o.paymentStatus !== "PENDING" || !["PENDING","PROCESSING"].includes(o.status))
    throw new PaymentError(409,"ORDER_NOT_PAYABLE");
}
function check(s: Stripe.Checkout.Session, o: Order, a?: PaymentAttempt | null) {
  if (s.metadata?.order_id !== o.id || s.mode !== "payment" ||
      s.amount_total !== cents(o) || s.currency !== o.currency.toLowerCase())
    throw new PaymentError(409,"PAYMENT_SESSION_MISMATCH");
  if (a) {
    if (a.amountCents !== cents(o) || a.currency !== s.currency ||
        (a.sessionId && a.sessionId !== s.id) ||
        (s.metadata?.attempt_id !== a.id && !(a.sessionId === s.id && !s.metadata?.attempt_id)))
      throw new PaymentError(409,"PAYMENT_ATTEMPT_MISMATCH");
  } else if (o.stripeSessionId !== s.id) throw new PaymentError(409,"PAYMENT_SESSION_UNRECOGNIZED");
}
function request(o: Order, id: string): Stripe.Checkout.SessionCreateParams {
  const success=process.env.STRIPE_SUCCESS_URL, cancel=process.env.STRIPE_CANCEL_URL;
  if (!success || !cancel) throw new PaymentError(503,"PAYMENT_URLS_NOT_CONFIGURED");
  return {mode:"payment",payment_method_types:["card"],
    success_url:success.replace("{ORDER_ID}",o.id),cancel_url:cancel.replace("{ORDER_ID}",o.id),
    line_items:[{quantity:1,price_data:{currency:o.currency.toLowerCase(),unit_amount:cents(o),
      product_data:{name:"Magic City Drip Order "+o.orderNumber}}}],
    metadata:{order_id:o.id,attempt_id:id},...(process.env.DEPLOYMENT_ENV==="staging"?{}:{customer_email:o.customerEmail})};
}
async function retrieve(id: string) {
  try { return await stripe.checkout.sessions.retrieve(id); }
  catch { throw new PaymentError(503,"PAYMENT_RETRY"); }
}
const reply=(s: Stripe.Checkout.Session)=>{
  if (s.status !== "open" || s.payment_status !== "unpaid" || !s.url)
    throw new PaymentError(409,"PAYMENT_NOT_OPEN");
  return {url:s.url,sessionId:s.id};
};
export async function startPayment(orderId: unknown): Promise<{url:string;sessionId:string}> {
  if (typeof orderId !== "string" || !orderId.trim() || orderId.length>128)
    throw new PaymentError(400,"INVALID_ORDER_ID");
  const attempt=await prisma.$transaction(async tx=>{
    const o=await lockedOrder(tx,orderId); payable(o);
    if (cents(o)<50 || cents(o)>2147483647 || !Number.isSafeInteger(cents(o))) throw new PaymentError(400,"INVALID_ORDER_TOTAL");
    const reservation=await tx.orderReservation.findUnique({where:{orderId}});
    if(!reservation)throw new ReservationError(409,"LEGACY_RESERVATION_REVIEW");
    const prev=await latest(tx,orderId);
    if(reservation && (reservation.state!=="ACTIVE" || reservation.expiresAt.getTime()<=Date.now()))
      throw new ReservationError(409,"RESERVATION_EXPIRED");
    if (prev && prev.state !== "EXPIRED") return prev;
    if(reservation && reservation.expiresAt.getTime()-Date.now()<PAYMENT_WINDOW_MS+5000)
      throw new ReservationError(409,"RESERVATION_PAYMENT_WINDOW_CLOSED");
    const id=randomUUID();
    return tx.paymentAttempt.create({data:{id,orderId,generation:(prev?.generation||0)+1,
      idempotencyKey:"pay:"+id,
      request:o.stripeSessionId && !prev ? {} : {...request(o,id),...(reservation?{expires_at:Math.floor(reservation.expiresAt.getTime()/1000)}:{})} as Prisma.InputJsonValue,
      amountCents:cents(o),currency:o.currency.toLowerCase(),
      sessionId:o.stripeSessionId && !prev ? o.stripeSessionId : null,
      state:o.stripeSessionId && !prev ? "ACTIVE":"CREATING"}});
  });
  if (attempt.sessionId) {
    const s=await retrieve(attempt.sessionId);
    const o=await prisma.order.findUniqueOrThrow({where:{id:orderId}});
    check(s,o,attempt);
    if (s.status==="expired") {
      await prisma.$transaction(async tx=>{
        await lockedOrder(tx,orderId);
        await tx.paymentAttempt.updateMany({where:{id:attempt.id,state:{not:"PAID"}},data:{state:"EXPIRED"}});
      });
      return startPayment(orderId);
    }
    payable(o); return reply(s);
  }
  // Unresolved keys must never be reused beyond Stripe's minimum 24h retention.
  if (Date.now()-attempt.createdAt.getTime()>=23*60*60*1000)
    throw new PaymentError(409,"PAYMENT_RECONCILIATION_REQUIRED");
  const owner=randomUUID();
  const claimed=await prisma.paymentAttempt.updateMany({
    where:{id:attempt.id,sessionId:null,OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]},
    data:{leaseOwner:owner,leaseUntil:new Date(Date.now()+30000)}});
  if (!claimed.count) {
    for(let i=0;i<20;i++) {
      await new Promise(r=>setTimeout(r,50));
      const saved=await prisma.paymentAttempt.findUniqueOrThrow({where:{id:attempt.id}});
      if(saved.sessionId) {
        const s=await retrieve(saved.sessionId),o=await prisma.order.findUniqueOrThrow({where:{id:orderId}});
        check(s,o,saved);payable(o);return reply(s);
      }
    }
    throw new PaymentError(503,"PAYMENT_RETRY");
  }
  try {
    const s=await stripe.checkout.sessions.create(attempt.request as unknown as Stripe.Checkout.SessionCreateParams,
      {idempotencyKey:attempt.idempotencyKey});
    await prisma.$transaction(async tx=>{
      const o=await lockedOrder(tx,orderId);check(s,o,attempt);
      const current=await latest(tx,orderId);
      if(current?.id!==attempt.id) throw new PaymentError(409,"PAYMENT_ATTEMPT_SUPERSEDED");
      await tx.paymentAttempt.update({where:{id:attempt.id},data:{sessionId:s.id,sessionUrl:s.url,
        state:current.state==="PAID"?"PAID":"ACTIVE",leaseOwner:null,leaseUntil:null}});
      await tx.order.update({where:{id:orderId},data:{stripeSessionId:s.id}});
      payable(o);
    });
    return reply(s);
  } catch(error) {
    if(error instanceof PaymentError || error instanceof ReservationError) throw error;
    throw new PaymentError(503,"PAYMENT_RETRY");
  } finally {
    await prisma.paymentAttempt.updateMany({where:{id:attempt.id,leaseOwner:owner},
      data:{leaseOwner:null,leaseUntil:null}}).catch(()=>{});
  }
}
export async function reconcilePayment(sessionId: string,event?:{id:string;type:string}) {
  const s=await retrieve(sessionId);
  if(s.id!==sessionId) throw new PaymentError(409,"PAYMENT_SESSION_MISMATCH");
  const orderId=s.metadata?.order_id;
  if(!orderId) throw new PaymentError(400,"MISSING_ORDER_ID");
  return prisma.$transaction(async tx=>{
    let o=await lockedOrder(tx,orderId);
    const a=await tx.paymentAttempt.findFirst({where:{orderId,OR:[
      {sessionId},...(s.metadata?.attempt_id?[{id:s.metadata.attempt_id}]:[])]}});
    check(s,o,a);
    if(event) {
      const old=await tx.stripeEvent.findUnique({where:{id:event.id}});
      if(old && (old.type!==event.type || old.sessionId!==sessionId))
        throw new PaymentError(409,"STRIPE_EVENT_CONFLICT");
      if(!old) await tx.stripeEvent.create({data:{...event,sessionId}});
    }
    const current=await latest(tx,orderId);
    const settlement=await tx.paymentFinalization.findUnique({where:{orderId}});
    const isCurrent=a?current?.id===a.id:!current;
    if(!isCurrent && settlement?.sessionId!==sessionId)
      return {paid:false,payment_status:s.payment_status,orderId};
    if(s.payment_status==="paid" && s.status==="complete") {
      if(o.paymentStatus==="PENDING" && !await tx.orderReservation.findUnique({where:{orderId}}))
        throw new ReservationError(409,"LEGACY_RESERVATION_REVIEW");
      if(settlement && settlement.sessionId!==sessionId) throw new PaymentError(409,"PAYMENT_ALREADY_FINALIZED");
      if(o.paymentStatus==="REFUNDED") return {paid:true,order:summary(o)};
      if(o.status==="CANCELLED" && o.paymentStatus!=="PAID") throw new PaymentError(409,"PAYMENT_RECONCILIATION_REQUIRED");
      if(!settlement) {
        await tx.paymentFinalization.create({data:{orderId,sessionId}});
        const reserved=await consumeReservation(tx,orderId);
        if(!reserved && o.paymentStatus==="PENDING" && o.discountCode) {
          await tx.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "code"=$1 FOR UPDATE',o.discountCode);
          const d=await tx.discount.findUnique({where:{code:o.discountCode}});
          if(d?.usageLimit!=null && d.usageCount+d.reservedUses>=d.usageLimit)
            throw new ReservationError(409,"LEGACY_DISCOUNT_REVIEW");
          await tx.discount.updateMany({where:{code:o.discountCode},data:{usageCount:{increment:1}}});
        }
      }
      if(o.paymentStatus==="PENDING") o=await tx.order.update({where:{id:orderId},data:{
        paymentStatus:"PAID",stripeSessionId:sessionId,status:["SHIPPED","DELIVERED"].includes(o.status)?o.status:"PROCESSING"}});
      if(a) await tx.paymentAttempt.update({where:{id:a.id},data:{
        state:"PAID",sessionId,sessionUrl:s.url,leaseOwner:null,leaseUntil:null}});
      return {paid:true,order:summary(o)};
    }
    if(a && s.status==="expired" && o.paymentStatus==="PENDING")
      await tx.paymentAttempt.updateMany({where:{id:a.id,state:{not:"PAID"}},data:{state:"EXPIRED"}});
    return {paid:false,payment_status:s.payment_status,orderId};
  });
}
function summary(o: Order) {
  const {id,orderNumber,paymentStatus,status,total,currency,discountCode}=o;
  return {id,orderNumber,paymentStatus,status,total,currency,discountCode};
}

export async function updateOrderState(id: string, status: unknown, paymentStatus: unknown) {
  const statuses=["PENDING","PROCESSING","SHIPPED","DELIVERED","CANCELLED"];
  const payments=["PENDING","PAID","REFUNDED"];
  if ((status !== undefined && (typeof status !== "string" || !statuses.includes(status))) ||
      (paymentStatus !== undefined && (typeof paymentStatus !== "string" || !payments.includes(paymentStatus))))
    throw new PaymentError(400,"INVALID_ORDER_STATE");
  return prisma.$transaction(async tx=>{
    const o=await lockedOrder(tx,id);
    const ranks:Record<string,number>={PENDING:0,PROCESSING:1,SHIPPED:2,DELIVERED:3};
    if(typeof status==="string" && status!==o.status &&
       ((o.status==="CANCELLED") || (status==="CANCELLED" && ranks[o.status]>=2) ||
         (status!=="CANCELLED" && ranks[status]<ranks[o.status])))
      throw new PaymentError(409,"ORDER_STATE_REGRESSION");
    if(typeof paymentStatus==="string" && paymentStatus!==o.paymentStatus &&
       (o.paymentStatus==="REFUNDED" || paymentStatus==="PENDING" ||
         (paymentStatus==="REFUNDED" && o.paymentStatus!=="PAID")))
      throw new PaymentError(409,"PAYMENT_STATE_REGRESSION");
    if(paymentStatus==="PAID" && o.paymentStatus==="PENDING") {
      if(!await consumeReservation(tx,id))throw new ReservationError(409,"LEGACY_RESERVATION_REVIEW");
    }
    return tx.order.update({where:{id},data:{
      ...(status ? {status:status as Order["status"]}:{}),
      ...(paymentStatus ? {paymentStatus:paymentStatus as Order["paymentStatus"]}:{}),
    },select:{id:true}});
  });
}
