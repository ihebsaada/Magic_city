import { Router } from "express";
import {
  getProducts,
  getProductById,
  getProductByHandle,
  adminGetProducts,
  adminGetProductById,
} from "../controllers/productController";

const router = Router();

router.get("/products", getProducts);
router.get("/products/handle/:handle", getProductByHandle);
router.get("/products/:id", getProductById);
// endpoints admin
router.get("/admin/products", adminGetProducts);
router.get("/admin/products/:id", adminGetProductById);

export default router;
