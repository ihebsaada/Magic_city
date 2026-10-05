

import prisma from "../prisma";
import {stripe} from "./stripeClient";
import {reconcilePayment,PaymentError} from "./paymentService";
import {releaseReservation,ReservationError} from "./reservations";

export async function reconcileReservation(orderId:string) {
  const r=await prisma.orderReservation.findUnique({where:{orderId}});
  if(!r || r.state!=="ACTIVE")return r;
  const o=await prisma.order.findUniqueOrThrow({where:{id:orderId}});
  if(o.paymentStatus!=="PENDING")return r;
  if(["SHIPPED","DELIVERED"].includes(o.status)) {
    return prisma.orderReservation.update({where:{orderId},data:{reconciliationReason:"FULFILLED_ORDER_PAYMENT_REVIEW"}});
  }
  if(r.expiresAt.getTime()>Date.now() && o.status!=="CANCELLED")return r;
  const attempts=await prisma.paymentAttempt.findMany({where:{orderId},orderBy:{generation:"asc"}});
  try {
    for(const a of attempts) {
      let s;
      if(a.sessionId)s=await stripe.checkout.sessions.retrieve(a.sessionId);
      else {
        if(Date.now()-a.createdAt.getTime()>=23*60*60*1000)
          throw new ReservationError(409,"UNKNOWN_STRIPE_ATTEMPT");
        // Recover an unknown result using the ORIGINAL stable key and parameters.
        s=await stripe.checkout.sessions.create(a.request as unknown as import("stripe").default.Checkout.SessionCreateParams,
          {idempotencyKey:a.idempotencyKey});
        s=await stripe.checkout.sessions.retrieve(s.id);
      }
      if(s.metadata?.order_id!==orderId || s.mode!=="payment" || s.amount_total!==a.amountCents ||
         s.currency!==a.currency || (s.metadata?.attempt_id!==a.id && !(a.sessionId===s.id && !s.metadata?.attempt_id)))
        throw new ReservationError(409,"STRIPE_RESERVATION_MISMATCH");
      if(s.payment_status==="paid" && s.status==="complete") {
        const result=await reconcilePayment(s.id);
        if(!result.paid)throw new ReservationError(409,"SUPERSEDED_PAID_SESSION");
        return prisma.orderReservation.findUnique({where:{orderId}});
      }
      if(s.status==="open" && s.payment_status==="unpaid") {
        // Only explicit cancellation or elapsed reservation triggers this call; no cron.
        const id=s.id;
        s=await stripe.checkout.sessions.expire(id);
        if(s.id!==id || s.metadata?.order_id!==orderId || s.amount_total!==a.amountCents || s.currency!==a.currency)
          throw new ReservationError(409,"STRIPE_RESERVATION_MISMATCH");
      }
      if(s.status!=="expired" || s.payment_status!=="unpaid")
        throw new ReservationError(409,"STRIPE_PAYMENT_UNCERTAIN");
      await prisma.$transaction(async tx=>{
        await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
        const current=await tx.order.findUniqueOrThrow({where:{id:orderId}});
        if(current.paymentStatus!=="PENDING")return;
        await tx.paymentAttempt.updateMany({where:{id:a.id,state:{not:"PAID"}},
          data:{sessionId:s.id,state:"EXPIRED",leaseOwner:null,leaseUntil:null}});
      });
    }
    return await prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
      const current=await tx.order.findUniqueOrThrow({where:{id:orderId}});
      if(current.paymentStatus!=="PENDING")return tx.orderReservation.findUnique({where:{orderId}});
      const currentAttempts=await tx.paymentAttempt.findMany({where:{orderId}});
      if(currentAttempts.length!==attempts.length || currentAttempts.some(a=>a.state!=="EXPIRED"))
        throw new ReservationError(409,"STRIPE_PAYMENT_UNCERTAIN");
      return releaseReservation(tx,orderId);
    });
  } catch(error) {
    // Never release on a timeout, an unknown session, or a failure to commit.
    await prisma.orderReservation.updateMany({where:{orderId,state:"ACTIVE"},
      data:{reconciliationReason:(error instanceof ReservationError || error instanceof PaymentError)?error.code:"RECONCILIATION_RETRY"}}).catch(()=>{});
    throw error instanceof ReservationError?error:error instanceof PaymentError?new ReservationError(error.status,error.code):new ReservationError(503,"RECONCILIATION_RETRY");
  }
}
