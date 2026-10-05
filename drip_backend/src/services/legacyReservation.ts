
import {Prisma} from "@prisma/client";
import prisma from "../prisma";
import {reserveOrder,ReservationError} from "./reservations";
// Explicit authenticated operator action only. Never run on /pay or startup.
export async function reserveLegacyOrder(orderId:string) {
 return prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
  const o=await tx.order.findUnique({where:{id:orderId},include:{items:true}});
  if(!o)throw new ReservationError(404,"ORDER_NOT_FOUND");
  const existing=await tx.orderReservation.findUnique({where:{orderId},include:{items:true}});
  if(existing)return existing;
  if(o.paymentStatus!=="PENDING" || !["PENDING","PROCESSING"].includes(o.status) || !o.items.length)
    throw new ReservationError(409,"LEGACY_RESERVATION_REVIEW");
  const ids=[...new Set(o.items.map(i=>i.productId))];
  if(ids.some(id=>id==null))throw new ReservationError(409,"LEGACY_VARIANT_REVIEW");
  for(const id of (ids as number[]).sort((a,b)=>a-b))
    await tx.$queryRawUnsafe('SELECT "id" FROM "Product" WHERE "id"=$1 FOR UPDATE',id);
  const products=await tx.product.findMany({where:{id:{in:ids as number[]}},include:{variants:true}});
  const quantities=new Map<number,number>();
  let totalQuantity=0;
  for(const item of o.items) {
    const p=products.find(p=>p.id===item.productId);
    const matches=p?.variants.filter(v=>
      (!item.variantSku || v.sku===item.variantSku) &&
      (!item.selectedSize || v.option1===item.selectedSize) &&
      (!item.selectedColor || v.option2===item.selectedColor));
    if(matches?.length!==1 || matches[0].option3)
      throw new ReservationError(409,"LEGACY_VARIANT_REVIEW");
    const id=matches[0].id,quantity=(quantities.get(id)||0)+item.quantity;
    totalQuantity+=item.quantity;
    if(!Number.isInteger(item.quantity) || item.quantity<=0 || quantity>99 || totalQuantity>1000)
      throw new ReservationError(409,"LEGACY_QUANTITY_REVIEW");
    quantities.set(id,quantity);
  }
  for(const id of [...quantities.keys()].sort((a,b)=>a-b))
    await tx.$queryRawUnsafe('SELECT "id" FROM "Variant" WHERE "id"=$1 FOR UPDATE',id);
  if(o.discountCode && !await tx.discount.findUnique({where:{code:o.discountCode}}))
    throw new ReservationError(409,"LEGACY_DISCOUNT_REVIEW");
  // Old totals and item prices are immutable. The operator approves this historical quote.
  await reserveOrder(tx,orderId,quantities,o.discountCode,new Date());
  return tx.orderReservation.findUniqueOrThrow({where:{orderId},include:{items:true}});
 },{maxWait:5000,timeout:10000});
}
