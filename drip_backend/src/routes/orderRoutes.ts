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
} from "../controllers/orderController";
import { requireAdminAuth } from "../middlewares/requireAdminAuth";

const router = Router();

// front boutique
router.post("/orders", createOrder);

router.post("/checkout/intent", createCheckoutIntent);
router.get("/orders/:id/min", getOrderMinimal);
router.post("/pay", createStripeCheckout);
router.get("/pay/confirm", confirmStripePayment);

router.use("/admin", requireAdminAuth);

// admin
router.get("/admin/orders", adminGetOrders);
router.get("/admin/orders/:id", adminGetOrderById);
router.get("/orders", adminGetOrders);
router.patch("/admin/orders/:id", adminUpdateOrder);

export default router;
