
import {createHash,randomBytes} from "node:crypto";
import {Prisma} from "@prisma/client";
import prisma from "../prisma";

export class GuestAccessError extends Error {
 constructor(public status:number,public code:string){super(code);}
}
export const PREPARE_MS=15*60*1000, ACCESS_MS=30*24*60*60*1000;
const secret=()=>randomBytes(32).toString("base64url");
export function accessHash(value:unknown):string {
 if(typeof value!=="string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
  throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
 return createHash("sha256").update(value).digest("hex");
}
export async function prepareGuestAccess() {
 const token=secret(),expiresAt=new Date(Date.now()+PREPARE_MS);
 await prisma.guestOrderAccess.create({data:{tokenHash:accessHash(token),expiresAt}});
 return {accessToken:token,expiresAt:expiresAt.toISOString()};
}
export async function bindGuestAccess(tx:Prisma.TransactionClient,tokenHash:string,orderId:string) {
 await tx.$queryRawUnsafe('SELECT "tokenHash" FROM "GuestOrderAccess" WHERE "tokenHash"=$1 FOR UPDATE',tokenHash);
 const row=await tx.guestOrderAccess.findUnique({where:{tokenHash}});
 if(!row || row.revokedAt || row.expiresAt.getTime()<=Date.now() || (row.orderId && row.orderId!==orderId))
  throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
 if(!row.orderId)await tx.guestOrderAccess.update({where:{tokenHash},data:{orderId,expiresAt:new Date(Date.now()+ACCESS_MS)}});
}
export async function authorizeGuestAccess(orderId:string,token:unknown) {
 const row=await prisma.guestOrderAccess.findUnique({where:{tokenHash:accessHash(token)}});
 if(!row || row.orderId!==orderId || row.revokedAt || row.expiresAt.getTime()<=Date.now())
  throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
}
export async function revokeGuestAccess(orderId:string) {
 return prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
  if(!await tx.order.findUnique({where:{id:orderId}}))throw new GuestAccessError(404,"ORDER_NOT_FOUND");
  await tx.navigationHandoff.updateMany({where:{orderId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.orderHandoff.updateMany({where:{expectedOrderId:orderId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.guestOrderAccess.updateMany({where:{orderId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.guestOrderRecovery.updateMany({where:{orderId,usedAt:null},data:{usedAt:new Date()}});
  return {ok:true};
 });
}
// Disabled unless an explicitly configured transport is injected. Never log delivery payloads.
export type RecoveryDelivery=(message:{email:string;recoveryToken:string;expiresAt:string})=>Promise<void>;
export async function requestGuestRecovery(orderId:unknown,email:unknown,delivery:RecoveryDelivery) {
 if(typeof orderId!=="string" || orderId.length>128 || typeof email!=="string" || email.length>254)return;
 const token=secret(),tokenHash=accessHash(token),expiresAt=new Date(Date.now()+PREPARE_MS);
 const recipient=await prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
  const order=await tx.order.findUnique({where:{id:orderId}});
  if(!order || order.customerEmail.trim().toLowerCase()!==email.trim().toLowerCase())return null;
  const count=await tx.guestOrderRecovery.count({where:{orderId,createdAt:{gt:new Date(Date.now()-3600000)}}});
  if(count>=5)return null;
  await tx.guestOrderRecovery.create({data:{tokenHash,orderId,expiresAt}});
  return order.customerEmail;
 });
 if(!recipient)return;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {await Promise.race([
  delivery({email:recipient,recoveryToken:token,expiresAt:expiresAt.toISOString()}),
  new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error("DELIVERY_TIMEOUT")),5000);})
 ]);}
 catch {await prisma.guestOrderRecovery.update({where:{tokenHash},data:{usedAt:new Date()}});}
 finally {if(timer)clearTimeout(timer);}
}
export async function redeemGuestRecovery(value:unknown) {
 const tokenHash=accessHash(value);
 return prisma.$transaction(async tx=>{
  // Read the target, then always lock order before challenge: same ordering as Admin revocation.

  const row=await tx.guestOrderRecovery.findUnique({where:{tokenHash}});
  if(!row || row.usedAt || row.expiresAt.getTime()<=Date.now())throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',row.orderId);
  await tx.$queryRawUnsafe('SELECT "tokenHash" FROM "GuestOrderRecovery" WHERE "tokenHash"=$1 FOR UPDATE',tokenHash);
  // Admin revocation or another redemption may have invalidated the challenge while waiting.
  const current=await tx.guestOrderRecovery.findUnique({where:{tokenHash}});
  if(!current || current.usedAt || current.expiresAt.getTime()<=Date.now())throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
  const token=secret(),expiresAt=new Date(Date.now()+ACCESS_MS);
  await tx.navigationHandoff.updateMany({where:{orderId:row.orderId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.orderHandoff.updateMany({where:{expectedOrderId:row.orderId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.guestOrderAccess.updateMany({where:{orderId:row.orderId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.guestOrderRecovery.updateMany({where:{orderId:row.orderId,usedAt:null},data:{usedAt:new Date()}});
  await tx.guestOrderAccess.create({data:{tokenHash:accessHash(token),orderId:row.orderId,expiresAt}});
  return {orderId:row.orderId,accessToken:token,expiresAt:expiresAt.toISOString()};
 });
}
