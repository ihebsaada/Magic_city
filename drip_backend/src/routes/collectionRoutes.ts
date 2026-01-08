import { Router } from "express";
import {
  getCollections,
  getCollectionProducts,
  adminGetCollections,
  adminGetCollectionWithProducts,
} from "../controllers/collectionController";

const router = Router();

router.get("/collections", getCollections);
router.get("/collections/:handle/products", getCollectionProducts);

// admin
router.get("/admin/collections", adminGetCollections);
router.get("/admin/collections/:handle", adminGetCollectionWithProducts);

export default router;
