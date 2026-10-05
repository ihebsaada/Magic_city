import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {Prisma} from '@prisma/client';
import prisma from '../prisma';
import {accessHash,GuestAccessError,ACCESS_MS} from './guestOrderAccess';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const fail=(status=401,code='NAVIGATION_DENIED')=>new GuestAccessError(status,code);
function id(v:unknown){if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))throw fail();return v;}
function key(){const s=process.env.NAVIGATION_HANDOFF_SECRET;if(!s||s.length<32)throw fail(503,'NAVIGATION_UNAVAILABLE');return createHash('sha256').update('navigation-ticket-v1:'+s).digest();}
function encrypt(v:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const b=Buffer.concat([c.update(v,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]).toString('base64url');}
function decrypt(v:string){const b=Buffer.from(v,'base64url'),c=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');}
async function grant(tx:Prisma.TransactionClient,h:string){await tx.$queryRawUnsafe('SELECT "tokenHash" FROM "GuestOrderAccess" WHERE "tokenHash"=$1 FOR UPDATE',h);const g=await tx.guestOrderAccess.findUnique({where:{tokenHash:h}});if(!g||g.revokedAt||g.expiresAt.getTime()<=Date.now())throw fail();return g;}
export async function createNavigation(order:unknown,token:unknown,creation:unknown,origin:string){
 const orderId=id(order),sourceHash=accessHash(token),creationKey=id(creation);if(creationKey.length<16)throw fail(400,'NAVIGATION_KEY_REQUIRED');
 const creationKeyHash=hash(sourceHash+':'+creationKey),requestHash=hash(orderId+':'+sourceHash+':'+origin);
 return prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
  const g=await grant(tx,sourceHash);if(g.orderId!==orderId)throw fail();
  const old=await tx.navigationHandoff.findUnique({where:{creationKeyHash}});
  if(old){if(old.requestHash!==requestHash)throw fail(409,'NAVIGATION_CONFLICT');if(old.revokedAt)throw fail();if(old.expiresAt.getTime()<=Date.now())throw fail(410,'NAVIGATION_EXPIRED');return {orderId,ticket:decrypt(old.ticketCiphertext),expiresAt:old.expiresAt.toISOString()};}
  if(await tx.navigationHandoff.count({where:{orderId,createdAt:{gt:new Date(Date.now()-3600000)}}})>=10)throw fail(429,'NAVIGATION_RATE_LIMIT');
  const ticket=randomBytes(32).toString('base64url'),expiresAt=new Date(Math.min(Date.now()+120000,g.expiresAt.getTime()));
  await tx.navigationHandoff.create({data:{ticketHash:hash(ticket),creationKeyHash,requestHash,ticketCiphertext:encrypt(ticket),orderId,sourceHash,checkoutOrigin:origin,expiresAt}});
  return {orderId,ticket,expiresAt:expiresAt.toISOString()};
 });
}
export async function redeemNavigation(order:unknown,value:unknown,token:unknown,origin:string){
 const orderId=id(order),ticket=id(value);if(ticket.length!==43)throw fail();const ticketHash=hash(ticket),recipientHash=accessHash(token);
 return prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "Order" WHERE "id"=$1 FOR UPDATE',orderId);
  await tx.$queryRawUnsafe('SELECT "ticketHash" FROM "NavigationHandoff" WHERE "ticketHash"=$1 FOR UPDATE',ticketHash);
  const row=await tx.navigationHandoff.findUnique({where:{ticketHash}});if(!row||row.orderId!==orderId||row.checkoutOrigin!==origin||row.revokedAt||row.sourceHash===recipientHash)throw fail();
  // Deterministic grant lock order prevents deadlocks between opposing transfers.
  const grants=new Map();for(const h of [...new Set([row.sourceHash,recipientHash])].sort())grants.set(h,await grant(tx,h));
  const source=grants.get(row.sourceHash),recipient=grants.get(recipientHash);if(source.orderId!==orderId)throw fail();
  if(row.redeemedAt){if(row.recipientHash!==recipientHash||recipient.orderId!==orderId)throw fail(409,'NAVIGATION_CONSUMED');return {orderId,authorized:true};}
  if(row.expiresAt.getTime()<=Date.now())throw fail(410,'NAVIGATION_EXPIRED');if(recipient.orderId)throw fail(409,'NAVIGATION_CONFLICT');
  await tx.guestOrderAccess.update({where:{tokenHash:recipientHash},data:{orderId,expiresAt:new Date(Math.min(Date.now()+ACCESS_MS,source.expiresAt.getTime()))}});
  await tx.navigationHandoff.update({where:{ticketHash},data:{recipientHash,redeemedAt:new Date()}});
  return {orderId,authorized:true};
 });
}
