import {guestOrderAccess} from "../middlewares/guestOrderAccess";
import {prepareAccess,revokeAccess,requestRecovery,redeemRecovery} from "../controllers/guestOrderAccessController";
// src/routes/orderRoutes.ts
import { Router } from "express";
import {
  createOrder,
  adminGetOrders,
  adminGetOrderById,
  createCheckoutIntent,
  getOrderMinimal,
  createStripeCheckout,
  confirmStripePayment,
  adminUpdateOrder,
  adminReconcileReservation,
  adminReserveLegacy,
} from "../controllers/orderController";
import { requireAdminAuth } from "../middlewares/requireAdminAuth";

const router = Router();

// Bounded, per-process throttle; distributed edge limits are required before public rollout.
const accessBuckets=new Map<string,{start:number;count:number}>();
const accessThrottle:import("express").RequestHandler=(req,res,next)=>{
 const now=Date.now(),key=req.path.toLowerCase().replace(/\/+$/,"")+":"+req.ip;
 if(accessBuckets.size>=10000)for(const [k,b] of accessBuckets)if(now-b.start>=60000)accessBuckets.delete(k);
 let b=accessBuckets.get(key);
 if(!b || now-b.start>=60000){
  if(!b && accessBuckets.size>=10000)return res.status(429).json({error:"ORDER_ACCESS_RATE_LIMIT"});
  b={start:now,count:0};accessBuckets.set(key,b);
 }
 if(++b.count>60){res.setHeader("Retry-After","60");return res.status(429).json({error:"ORDER_ACCESS_RATE_LIMIT"});}
 next();
};
router.use("/order-access",accessThrottle);
router.post("/order-access/prepare",prepareAccess);
router.post("/order-access/recovery",requestRecovery);
router.post("/order-access/redeem",redeemRecovery);
const requirePreparedAccess: import("express").RequestHandler=(req,res,next)=>{
 if(req.app.locals.orderAccessRequired && req.headers["order-access-token"]===undefined)
  return res.status(401).json({error:"ORDER_ACCESS_DENIED"});
 next();
};
// front boutique
router.post("/orders", requirePreparedAccess, createOrder);

router.post("/checkout/intent", requirePreparedAccess, createCheckoutIntent);
router.get("/orders/:id/min", guestOrderAccess, getOrderMinimal);
router.post("/pay", guestOrderAccess, createStripeCheckout);
router.get("/pay/confirm", guestOrderAccess, confirmStripePayment);

router.use("/admin", requireAdminAuth);

// admin
router.get("/admin/orders", adminGetOrders);
router.get("/admin/orders/:id", adminGetOrderById);
router.get("/orders", requireAdminAuth, adminGetOrders);
router.patch("/admin/orders/:id", adminUpdateOrder);
router.post("/admin/orders/:id/revoke-access",revokeAccess);
router.post("/admin/orders/:id/reconcile-reservation",adminReconcileReservation);
router.post("/admin/orders/:id/reserve-legacy",adminReserveLegacy);

export default router;
