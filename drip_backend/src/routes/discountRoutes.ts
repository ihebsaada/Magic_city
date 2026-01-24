import { Router } from "express";
import {
  adminCreateDiscount,
  adminDeleteDiscount,
  adminGetDiscounts,
  adminUpdateDiscount,
  previewDiscount,
} from "../controllers/discountController";
import { requireAdminAuth } from "../middlewares/requireAdminAuth";

const router = Router();

// ✅ PUBLIC (shop): preview code
router.post("/discounts/preview", previewDiscount);

// ✅ ADMIN (dashboard): CRUD protected
router.use("/admin", requireAdminAuth);

router.get("/admin/discounts", adminGetDiscounts);
router.post("/admin/discounts", adminCreateDiscount);
router.patch("/admin/discounts/:id", adminUpdateDiscount);
router.delete("/admin/discounts/:id", adminDeleteDiscount);

export default router;
