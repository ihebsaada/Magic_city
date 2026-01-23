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
router.post("/discounts/preview", previewDiscount);

router.use(requireAdminAuth);

router.get("/discounts", adminGetDiscounts);
router.post("/discounts", adminCreateDiscount);
router.patch("/discounts/:id", adminUpdateDiscount);
router.delete("/discounts/:id", adminDeleteDiscount);

export default router;
