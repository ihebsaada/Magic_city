import { Router } from "express";
import {
  getCollections,
  getCollectionProducts,
  adminGetCollections,
  adminGetCollectionWithProducts,
  adminCreateCollection,
  adminUpdateCollection,
  adminAddProductToCollection,
  adminRemoveProductFromCollection,
  adminDeleteCollection,
} from "../controllers/collectionController";
import { requireAdminAuth } from "../middlewares/requireAdminAuth";

const router = Router();

router.get("/collections", getCollections);
router.get("/collections/:handle/products", getCollectionProducts);

router.use("/admin", requireAdminAuth);
// admin
router.get("/admin/collections", adminGetCollections);
router.get("/admin/collections/:handle", adminGetCollectionWithProducts);
router.post("/admin/collections", adminCreateCollection);
router.patch("/admin/collections/:id", adminUpdateCollection);
router.post("/admin/collections/:id/products", adminAddProductToCollection);
router.delete(
  "/admin/collections/:id/products/:productId",
  adminRemoveProductFromCollection,
);
router.delete("/admin/collections/:id", adminDeleteCollection);

export default router;
