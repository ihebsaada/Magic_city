import { Router } from "express";
import { adminLogin } from "../controllers/adminAuthController";

const router = Router();

// ✅ PUBLIC: pas de requireAdminAuth ici
router.post("/admin/auth/login", adminLogin);

export default router;
