import { Router } from "express";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controllers.js";
import { AdminVerifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public
router.get("/", getAllCategories);

// Admin-only
router.post("/admin", AdminVerifyJWT, createCategory);
router.patch("/admin/:id", AdminVerifyJWT, updateCategory);
router.delete("/admin/:id", AdminVerifyJWT, deleteCategory);

export default router;
