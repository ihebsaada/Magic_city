import { randomBytes, createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../prisma";
import { accessHash, ACCESS_MS, GuestAccessError } from "./guestOrderAccess";

const denied = () => new GuestAccessError(401, "HANDOFF_DENIED");
function identifier(value: unknown): string {
 if(typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw denied();
 return value;
}
function view(row: {id:string;expectedOrderId:string;expiresAt:Date;approvedAt:Date|null}) {
 return {pairingId:row.id,orderId:row.expectedOrderId,
  phrase:createHash("sha256").update(row.id).digest("hex").slice(0,12).match(/.{4}/g)!.join("-"),
  expiresAt:row.expiresAt.toISOString(),state:row.approvedAt?"approved":"pending"};
}
async function lockGrant(tx:Prisma.TransactionClient,hash:string) {
 await tx.$queryRawUnsafe('SELECT "tokenHash" FROM "GuestOrderAccess" WHERE "tokenHash"=$1 FOR UPDATE',hash);
 const grant=await tx.guestOrderAccess.findUnique({where:{tokenHash:hash}});
 if(!grant || grant.revokedAt || grant.expiresAt.getTime()<=Date.now()) throw denied();
 return grant;
}
export async function createHandoff(order:unknown,token:unknown,origin:string) {
 const expectedOrderId=identifier(order),recipientHash=accessHash(token);
 return prisma.$transaction(async tx=>{
  // Serialize quotas without revealing whether the public order reference exists.
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text',expectedOrderId);
  const grant=await lockGrant(tx,recipientHash);
  const previous=await tx.orderHandoff.findUnique({where:{recipientHash}});
  if(previous) {
   if(previous.expectedOrderId!==expectedOrderId || previous.origin!==origin) throw new GuestAccessError(409,"HANDOFF_CONFLICT");
   if(previous.revokedAt || previous.expiresAt.getTime()<=Date.now()) throw new GuestAccessError(410,"HANDOFF_EXPIRED");
   return view(previous);
  }
  if(grant.orderId) throw denied();
  if(await tx.orderHandoff.count({where:{expectedOrderId,createdAt:{gt:new Date(Date.now()-3600000)}}})>=10)
   throw new GuestAccessError(429,"HANDOFF_RATE_LIMIT");
  const row=await tx.orderHandoff.create({data:{
   id:randomBytes(24).toString("base64url"),expectedOrderId,recipientHash,origin,
   expiresAt:new Date(Math.min(Date.now()+5*60000,grant.expiresAt.getTime()))
  }});
  return view(row);
 });
}
export async function approveHandoff(order:unknown,pairing:unknown,token:unknown,approve:boolean) {
 const orderId=identifier(order),id=identifier(pairing),sourceHash=accessHash(token);
 return prisma.$transaction(async tx=>{
  // Same lock order as revocation, recovery and payment: order first.
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
  const source=await lockGrant(tx,sourceHash);
  if(source.orderId!==orderId) throw denied();
  await tx.$queryRawUnsafe('SELECT "id" FROM "OrderHandoff" WHERE "id"=$1 FOR UPDATE',id);
  const row=await tx.orderHandoff.findUnique({where:{id}});
  if(!row || row.expectedOrderId!==orderId || row.revokedAt) throw denied();
  if(row.expiresAt.getTime()<=Date.now()) throw new GuestAccessError(410,"HANDOFF_EXPIRED");
  const recipient=await lockGrant(tx,row.recipientHash);
  if(recipient.orderId && recipient.orderId!==orderId) throw denied();
  if(approve && !row.approvedAt) {
   if(recipient.orderId) throw denied();
   await tx.guestOrderAccess.update({where:{tokenHash:row.recipientHash},data:{orderId,expiresAt:new Date(Date.now()+ACCESS_MS)}});
   const updated=await tx.orderHandoff.update({where:{id},data:{approvedAt:new Date()}});
   return view(updated);
  }
  return view(row);
 });
}
export async function redeemHandoff(pairing:unknown,token:unknown,origin:string) {
 const id=identifier(pairing),recipientHash=accessHash(token);
 return prisma.$transaction(async tx=>{
  const initial=await tx.orderHandoff.findUnique({where:{id}});
  if(!initial || initial.recipientHash!==recipientHash || initial.origin!==origin) throw denied();
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',initial.expectedOrderId);
  await tx.$queryRawUnsafe('SELECT "id" FROM "OrderHandoff" WHERE "id"=$1 FOR UPDATE',id);
  const row=await tx.orderHandoff.findUniqueOrThrow({where:{id}});
  if(row.revokedAt) throw denied();
  const grant=await lockGrant(tx,recipientHash);
  if(!row.approvedAt) {
   if(row.expiresAt.getTime()<=Date.now()) throw new GuestAccessError(410,"HANDOFF_EXPIRED");
   return view(row);
  }
  if(grant.orderId!==row.expectedOrderId) throw denied();
  if(!row.redeemedAt) await tx.orderHandoff.update({where:{id},data:{redeemedAt:new Date()}});
  // Approved grants may be recovered after the five-minute pairing window.
  return {...view(row),expiresAt:grant.expiresAt.toISOString()};
 });
}
