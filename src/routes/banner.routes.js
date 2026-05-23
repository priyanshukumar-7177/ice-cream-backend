import { Router } from "express";
import {
  getActiveBanners,
  getAllBanners,
  uploadBanner,
  updateBanner,
  toggleBannerActive,
  deleteBanner,
} from "../controllers/banner.controllers.js";
import { AdminVerifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public — homepage carousel
router.get("/", getActiveBanners);

// Admin-only
router.get("/admin", AdminVerifyJWT, getAllBanners);
router.post(
  "/admin",
  AdminVerifyJWT,
  upload.fields([{ name: "banner", maxCount: 1 }]),
  uploadBanner
);
router.patch(
  "/admin/:id",
  AdminVerifyJWT,
  upload.fields([{ name: "banner", maxCount: 1 }]),
  updateBanner
);
router.patch("/admin/:id/toggle", AdminVerifyJWT, toggleBannerActive);
router.delete("/admin/:id", AdminVerifyJWT, deleteBanner);

export default router;
