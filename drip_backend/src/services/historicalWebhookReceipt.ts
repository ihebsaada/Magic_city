import {createHash,createHmac} from 'crypto';
import Stripe from 'stripe';
import prisma from '../prisma';
import {SecureOrderPolicyError} from './secureOrderPolicy';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
// Call ONLY after signature and environment mode verification. No provider calls.
export async function quarantineHistoricalWebhook(event:Stripe.Event,raw:Buffer,orderId:string) {
 const secret=process.env.NAVIGATION_HANDOFF_SECRET;
 if(!secret || secret.length<32)throw new SecureOrderPolicyError(503,'WEBHOOK_QUARANTINE_UNAVAILABLE');
 if(!event.id || typeof event.livemode!=='boolean')throw new SecureOrderPolicyError(400,'WEBHOOK_EVENT_INVALID');
 const s=event.data.object as Stripe.Checkout.Session;
 if(s.livemode!==undefined && s.livemode!==event.livemode)throw new SecureOrderPolicyError(400,'WEBHOOK_EVENT_MODE_CONFLICT');
 if(!s.id)throw new SecureOrderPolicyError(400,'WEBHOOK_EVENT_INVALID');
 const eventHash=hash(event.id),payloadHash=hash(raw);
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
  const orders=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
  if(!orders.length)throw new SecureOrderPolicyError(409,'WEBHOOK_ORDER_UNKNOWN');
  // Missing table/read error propagates: NEVER ACK on unavailable classification.
  const policy=await tx.secureOrderPolicy.findUnique({where:{orderId}});
  if(policy)throw new SecureOrderPolicyError(409,'WEBHOOK_POLICY_CONFLICT');
  const attempt=await tx.paymentAttempt.findUnique({where:{sessionId:s.id},select:{orderId:true}});
  const linked=await tx.order.findFirst({where:{stripeSessionId:s.id},select:{id:true}});
  if((attempt && attempt.orderId!==orderId)||(linked && linked.id!==orderId)||(s.metadata?.order_id && s.metadata.order_id!==orderId))
   throw new SecureOrderPolicyError(409,'WEBHOOK_ORDER_CONFLICT');
  // Event-level lock also serializes conflicting payloads aimed at different orders.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventHash},0))`;
  const previous=await tx.historicalWebhookReceipt.findUnique({where:{eventHash}});
  if(previous){
   if(previous.payloadHash!==payloadHash)throw new SecureOrderPolicyError(409,'WEBHOOK_RECEIPT_CONFLICT');
   return;
  }
  await tx.historicalWebhookReceipt.create({data:{eventHash,payloadHash,
   orderAlias:createHmac('sha256',secret).update('historical-webhook-order:'+orderId).digest('hex'),
   sessionHash:hash(s.id),eventType:event.type,livemode:event.livemode,severity:event.livemode?'CRITICAL':'WARNING'}});
  // PENDING receipt is the durable, deduplicated operator alert. No raw payload/log.
 });
}
