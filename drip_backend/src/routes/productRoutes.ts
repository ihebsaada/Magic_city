import { Router } from "express";
import {
  getProducts,
  getProductById,
  getProductByHandle,
  adminGetProducts,
  adminGetProductById,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminSetProductCollections,
  adminUpdateDefaultVariant,
} from "../controllers/productController";
import { requireAdminAuth } from "../middlewares/requireAdminAuth";

const router = Router();

router.get("/products", getProducts);
router.get("/products/handle/:handle", getProductByHandle);
router.get("/products/:id", getProductById);

router.use("/admin", requireAdminAuth);
// endpoints admin
router.get("/admin/products", adminGetProducts);
router.get("/admin/products/:id", adminGetProductById);
router.post("/admin/products", adminCreateProduct);
router.patch("/admin/products/:id", adminUpdateProduct);
router.delete("/admin/products/:id", adminDeleteProduct);
router.put("/admin/products/:id/collections", adminSetProductCollections);
router.patch("/admin/products/:id/default-variant", adminUpdateDefaultVariant);

export default router;
