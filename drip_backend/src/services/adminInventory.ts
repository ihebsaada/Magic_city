

import prisma from "../prisma";
import {ReservationError} from "./reservations";
export function stockValue(value:unknown):number|null {
 if(value===null)return null;
 const n=typeof value==="string" && value.trim()?Number(value):value;
 if(typeof n!=="number" || !Number.isInteger(n) || n<0 || n>2147483647)
   throw new ReservationError(400,"INVALID_STOCK");
 return n;
}
export async function updateVariantStock(productId:number,body:Record<string,unknown>) {
 return prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "Product" WHERE "id"=$1 FOR UPDATE',productId);
  const product=await tx.product.findUnique({where:{id:productId}});
  if(!product)throw new ReservationError(404,"PRODUCT_NOT_FOUND");
  if(body.variantId!==undefined && (typeof body.variantId!=="number" || !Number.isInteger(body.variantId)))
    throw new ReservationError(400,"INVALID_VARIANT");
  const first=await tx.variant.findFirst({where:{productId,...(body.variantId!==undefined?{id:body.variantId as number}:{})},orderBy:{id:"asc"}});
  if(body.variantId!==undefined && !first)throw new ReservationError(404,"VARIANT_NOT_FOUND");
  if(first)await tx.$queryRawUnsafe('SELECT "id" FROM "Variant" WHERE "id"=$1 FOR UPDATE',first.id);
  const v=first?await tx.variant.findUniqueOrThrow({where:{id:first.id}}):null;
  const inventoryQuantity=body.inventoryQuantity!==undefined?stockValue(body.inventoryQuantity):undefined;
  if(inventoryQuantity!==undefined && (inventoryQuantity??0)<(v?.reservedQuantity??0))
    throw new ReservationError(409,"STOCK_BELOW_RESERVATIONS");
  const price=body.price!==undefined?Number(body.price):undefined;
  if(price!==undefined && (!Number.isFinite(price) || price<=0))throw new ReservationError(400,"INVALID_PRICE");
  const compareAtPrice=body.compareAtPrice===null?null:body.compareAtPrice!==undefined?Number(body.compareAtPrice):undefined;
  if(compareAtPrice!=null && (!Number.isFinite(compareAtPrice)||compareAtPrice<0))throw new ReservationError(400,"INVALID_PRICE");
  const sku=typeof body.sku==="string" && body.sku.trim()?body.sku.trim():undefined;
  const data={price,compareAtPrice,inventoryQuantity,sku};
  return v?tx.variant.update({where:{id:v.id},data}):
   tx.variant.create({data:{...data,productId,title:"Default",price:price??0,inventoryQuantity:inventoryQuantity===undefined?0:inventoryQuantity}});
 });
}
