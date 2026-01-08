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
} from "../controllers/orderController";

const router = Router();

// front boutique
router.post("/orders", createOrder);

router.post("/checkout/intent", createCheckoutIntent);
router.get("/orders/:id/min", getOrderMinimal);
router.post("/pay", createStripeCheckout);
router.get("/pay/confirm", confirmStripePayment);

// admin
router.get("/admin/orders", adminGetOrders);
router.get("/admin/orders/:id", adminGetOrderById);

export default router;
