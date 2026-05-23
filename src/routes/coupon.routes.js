import { Router } from "express";
import {
  getAllCoupons,
  createCoupon,
  toggleCouponActive,
  deleteCoupon,
} from "../controllers/coupon.controllers.js";
import { AdminVerifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All admin-only
router.get("/", AdminVerifyJWT, getAllCoupons);
router.post("/", AdminVerifyJWT, createCoupon);
router.patch("/:id/toggle", AdminVerifyJWT, toggleCouponActive);
router.delete("/:id", AdminVerifyJWT, deleteCoupon);

export default router;
