
import { Prisma } from "@prisma/client";
export class ReservationError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export const RESERVATION_MS = 60 * 60 * 1000;
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;
export async function reserveOrder(tx: Prisma.TransactionClient, orderId: string,
    lines: Map<number,number>, discountCode: string | null, anchor?:Date) {
  const created=await tx.order.findUniqueOrThrow({where:{id:orderId}});
  const expiresAt=new Date((anchor??created.createdAt).getTime()+RESERVATION_MS);
  let discountId:string|null=null;
  for(const [variantId,quantity] of [...lines].sort(([a],[b])=>a-b)) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Variant" WHERE "id"=$1 FOR UPDATE',variantId);
    const v=await tx.variant.findUniqueOrThrow({where:{id:variantId}});
    if(v.inventoryQuantity==null || v.inventoryQuantity-v.reservedQuantity<quantity)
      throw new ReservationError(409,"VARIANT_OUT_OF_STOCK");
    await tx.variant.update({where:{id:variantId},data:{reservedQuantity:{increment:quantity}}});
  }
  if(discountCode) {
    // prepareOrder already locks the discount before pricing; lock again for callers' safety.
    await tx.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "code"=$1 FOR UPDATE',discountCode);
    const d=await tx.discount.findUniqueOrThrow({where:{code:discountCode}});
    if(d.usageLimit!=null && d.usageCount+d.reservedUses>=d.usageLimit)
      throw new ReservationError(409,"DISCOUNT_UNAVAILABLE");
    discountId=d.id;
    await tx.discount.update({where:{id:d.id},data:{reservedUses:{increment:1}}});
  }
  await tx.orderReservation.create({data:{orderId,expiresAt,discountId,
    items:{create:[...lines].map(([variantId,quantity])=>({variantId,quantity}))}}});
}
export async function consumeReservation(tx: Prisma.TransactionClient,orderId:string) {
  // Caller holds the order row lock. Null denotes an unchanged legacy order.
  const r=await tx.orderReservation.findUnique({where:{orderId},include:{items:true}});
  if(!r)return false;
  if(r.state==="CONSUMED")return true;
  if(r.state!=="ACTIVE")throw new ReservationError(409,"RESERVATION_RELEASED_PAYMENT_REVIEW");
  for(const line of [...r.items].sort((a,b)=>a.variantId-b.variantId)) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Variant" WHERE "id"=$1 FOR UPDATE',line.variantId);
    const v=await tx.variant.findUniqueOrThrow({where:{id:line.variantId}});
    if(v.inventoryQuantity==null || v.reservedQuantity<line.quantity || v.inventoryQuantity<line.quantity)
      throw new ReservationError(409,"RESERVATION_COUNTER_MISMATCH");
    await tx.variant.update({where:{id:v.id},data:{
      inventoryQuantity:{decrement:line.quantity},reservedQuantity:{decrement:line.quantity}}});
  }
  if(r.discountId) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "id"=$1 FOR UPDATE',r.discountId);
    const d=await tx.discount.findUniqueOrThrow({where:{id:r.discountId}});
    if(d.reservedUses<1)throw new ReservationError(409,"DISCOUNT_COUNTER_MISMATCH");
    await tx.discount.update({where:{id:d.id},data:{reservedUses:{decrement:1},usageCount:{increment:1}}});
  }
  await tx.orderReservation.update({where:{orderId},data:{state:"CONSUMED",reconciliationReason:null}});
  return true;
}
export async function releaseReservation(tx: Prisma.TransactionClient,orderId:string) {
  // Caller holds the order row lock AND has proved all Stripe sessions cannot still pay.
  const r=await tx.orderReservation.findUnique({where:{orderId},include:{items:true}});
  if(!r || r.state!=="ACTIVE")return r;
  const o=await tx.order.findUniqueOrThrow({where:{id:orderId}});
  if(r.expiresAt.getTime()>Date.now() && o.status!=="CANCELLED")return r;
  if(o.paymentStatus!=="PENDING" || ["SHIPPED","DELIVERED"].includes(o.status))
    throw new ReservationError(409,"RESERVATION_PAYMENT_REVIEW");
  for(const line of [...r.items].sort((a,b)=>a.variantId-b.variantId)) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Variant" WHERE "id"=$1 FOR UPDATE',line.variantId);
    const v=await tx.variant.findUniqueOrThrow({where:{id:line.variantId}});
    if(v.reservedQuantity<line.quantity)throw new ReservationError(409,"RESERVATION_COUNTER_MISMATCH");
    await tx.variant.update({where:{id:v.id},data:{reservedQuantity:{decrement:line.quantity}}});
  }
  if(r.discountId) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "id"=$1 FOR UPDATE',r.discountId);
    const d=await tx.discount.findUniqueOrThrow({where:{id:r.discountId}});
    if(d.reservedUses<1)throw new ReservationError(409,"DISCOUNT_COUNTER_MISMATCH");
    await tx.discount.update({where:{id:d.id},data:{reservedUses:{decrement:1}}});
  }
  await tx.order.update({where:{id:orderId},data:{status:"CANCELLED"}});
  return tx.orderReservation.update({where:{orderId},data:{state:"RELEASED",reconciliationReason:null}});
}
