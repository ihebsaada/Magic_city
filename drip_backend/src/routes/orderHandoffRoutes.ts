import { Router, RequestHandler } from "express";
import { createHandoff, approveHandoff, redeemHandoff } from "../services/orderHandoff";
import { GuestAccessError } from "../services/guestOrderAccess";

export const DEFAULT_HANDOFF_ORIGINS={store:"https://magiccitydrip.shop",checkout:"https://dripcheckout.netlify.app"};
export function handoffCors(origins=DEFAULT_HANDOFF_ORIGINS):RequestHandler {
 return (req,res,next)=>{
  const relevant=/^\/api\/(?:order-handoffs(?:\/|$)|orders\/[^/]+\/handoffs(?:\/|$))/i.test(req.path);
  if(!relevant) return next();
  const origin=req.get("Origin");
  res.set({"Cache-Control":"no-store","Pragma":"no-cache","Referrer-Policy":"no-referrer","Vary":"Origin"});
  const expected=req.path.toLowerCase().includes("/orders/")?origins.store:origins.checkout;
  if(origin!==expected) return res.status(403).json({error:"HANDOFF_ORIGIN_DENIED"});
  res.set({"Access-Control-Allow-Origin":expected,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Order-Access-Token"});
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
 };
}
const buckets=new Map<string,{time:number;count:number}>();
export const throttle:RequestHandler=(req,res,next)=>{
 const now=Date.now(),key=req.ip||"unknown";
 if(buckets.size>=10000)for(const [k,v] of buckets)if(now-v.time>=60000)buckets.delete(k);
 let bucket=buckets.get(key);
 if(!bucket || now-bucket.time>=60000) {
  if(!bucket && buckets.size>=10000)return res.status(429).json({error:"HANDOFF_RATE_LIMIT"});
  bucket={time:now,count:0};buckets.set(key,bucket);
 }
 if(++bucket.count>60){res.set("Retry-After","60");return res.status(429).json({error:"HANDOFF_RATE_LIMIT"});}
 next();
};
const handler=(run:(req:Parameters<RequestHandler>[0])=>Promise<unknown>):RequestHandler=>async(req,res)=>{
 try {res.json(await run(req));}
 catch(error){if(error instanceof GuestAccessError){if(error.status===429)res.set("Retry-After","60");res.status(error.status).json({error:error.code});}
 else res.status(503).json({error:"HANDOFF_RETRY"});}
};
const router=Router();
router.post("/order-handoffs",throttle,handler(req=>createHandoff(req.body?.orderId,req.get("Order-Access-Token"),req.get("Origin")!)));
router.post("/order-handoffs/:pairingId/redeem",throttle,handler(req=>redeemHandoff(req.params.pairingId,req.get("Order-Access-Token"),req.get("Origin")!)));
router.post("/orders/:id/handoffs/:pairingId/inspect",throttle,handler(req=>approveHandoff(req.params.id,req.params.pairingId,req.get("Order-Access-Token"),false)));
router.post("/orders/:id/handoffs/:pairingId/approve",throttle,handler(req=>approveHandoff(req.params.id,req.params.pairingId,req.get("Order-Access-Token"),true)));
export default router;
