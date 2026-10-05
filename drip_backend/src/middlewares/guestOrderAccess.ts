
import {Request,Response,NextFunction} from "express";
import prisma from "../prisma";
import {stripe} from "../services/stripeClient";
import {accessHash} from "../services/guestOrderAccess";
import {authorizeGuestAccess,GuestAccessError} from "../services/guestOrderAccess";
export async function guestOrderAccess(req:Request,res:Response,next:NextFunction) {
 try {
  const token=req.headers["order-access-token"];
  // Credentials in URLs are never supported, including during compatibility mode.
  if(Object.keys(req.query).some(k=>/^(?:token|accessToken|access_token|order-access-token|recoveryToken|recovery_token)$/i.test(k)))
   throw new GuestAccessError(400,"ORDER_ACCESS_HEADER_REQUIRED");
  if(token===undefined && !req.app.locals.orderAccessRequired)return next();
  if(token===undefined)throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
  let orderId:unknown=req.params.id ?? req.body?.orderId;
  if(req.path.toLowerCase()==="/pay/confirm") {
   if(typeof req.query.session_id!=="string" || !req.query.session_id || req.query.session_id.length>255)throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
   const grant=await prisma.guestOrderAccess.findUnique({where:{tokenHash:accessHash(token)}});
   if(!grant?.orderId)throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
   await authorizeGuestAccess(grant.orderId,token);
   const attempt=await prisma.paymentAttempt.findUnique({where:{sessionId:req.query.session_id},select:{orderId:true}});
   // Existing sessions are bound locally, never trust an orderId supplied alongside a session.
   orderId=attempt?.orderId ?? (await prisma.order.findFirst({where:{stripeSessionId:req.query.session_id},select:{id:true}}))?.id;
   if(!orderId){
    // Stripe may have succeeded before its session ID was persisted locally.
    // Validate the credential first; paymentService still verifies amount, currency and attempt.
    const session=await stripe.checkout.sessions.retrieve(req.query.session_id);
    if(session.metadata?.order_id!==grant.orderId)throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
    orderId=grant.orderId;
   }
  }
  if(typeof orderId!=="string")throw new GuestAccessError(401,"ORDER_ACCESS_DENIED");
  await authorizeGuestAccess(orderId,token);next();
 }catch(error){
  if(error instanceof GuestAccessError)return res.status(error.status).json({error:error.code});
  return res.status(503).json({error:"ORDER_ACCESS_RETRY"});
 }
}
