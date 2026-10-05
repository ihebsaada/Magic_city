import handoffRoutes, {handoffCors, DEFAULT_HANDOFF_ORIGINS} from "./routes/orderHandoffRoutes";
import {RecoveryDelivery} from "./services/guestOrderAccess";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import collectionRoutes from "./routes/collectionRoutes";
import productRoutes from "./routes/productRoutes";
import { stripeWebhook } from "./controllers/stripeWebhookController";
import { getCollectionBrands } from "./controllers/collectionController";
import orderRoutes from "./routes/orderRoutes";
import adminAuthRoutes from "./routes/adminAuthRoutes";
import adminDiscountRouter from "./routes/discountRoutes";

export function createApp({ logging = true, orderAccessRequired=false, orderRecoveryDelivery, handoffOrigins=DEFAULT_HANDOFF_ORIGINS, allowedOrigins, staging=false }: { logging?: boolean; orderAccessRequired?:boolean; orderRecoveryDelivery?:RecoveryDelivery; handoffOrigins?:typeof DEFAULT_HANDOFF_ORIGINS; allowedOrigins?:string[]; staging?:boolean } = {}) {
  const app = express();
  app.locals.orderAccessRequired=orderAccessRequired;
  app.locals.staging=staging;
  if(allowedOrigins)app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});const origin=req.get('Origin');if(origin && !allowedOrigins.includes(origin))return res.status(403).json({error:'ORIGIN_DENIED'});next();});
  app.get('/healthz',(_req,res)=>res.json({ok:true}));
  app.locals.orderRecoveryDelivery=orderRecoveryDelivery;
  if (logging) app.use(morgan(":method :status :response-time ms", {
    skip: (req) => /^\/api\/(?:orders|order-handoffs|order-access|admin|checkout|pay|stripe)(?:\/|$)/i.test(req.path),
  }));
  app.use("/api", (req, res, next) => {
    if (/^\/(?:orders|order-handoffs|order-access|admin|checkout|pay|stripe)(?:\/|$)/i.test(req.path)) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Referrer-Policy","no-referrer");
      if(Object.keys(req.query).some(k=>/^(?:token|accessToken|access_token|order-access-token|recoveryToken|recovery_token)$/i.test(k)))
        return res.status(400).json({error:"ORDER_ACCESS_HEADER_REQUIRED"});
    }
    next();
  });

  app.use(handoffCors(handoffOrigins));
  app.use((req,res,next)=>req.path.toLowerCase().includes("/order-handoffs") || /\/orders\/[^/]+\/handoffs/i.test(req.path)?next():cors(allowedOrigins?{origin:allowedOrigins,allowedHeaders:["Content-Type","Authorization","Order-Access-Token","Idempotency-Key"]}:undefined)(req,res,next));

  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );

  app.use(express.json());

  // Juste pour tester
  app.get("/", (_req, res) => {
    res.send("Magic City Drip API 🧥👟👜");
  });
  app.use("/api", adminAuthRoutes);
  app.use("/api", collectionRoutes);
  app.use("/api", productRoutes);
  app.use("/api", handoffRoutes);
  app.use("/api", orderRoutes);
  app.use("/api", adminDiscountRouter);

  app.get("/api/collections/:handle/brands", getCollectionBrands);


  // Express JSON parser errors otherwise include body excerpts in the default error page.
  app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=(error as {status?:number})?.status;
    res.status(status===400?400:500).json({error:status===400?"INVALID_REQUEST":"SERVER_ERROR"});
  });
  return app;
}
