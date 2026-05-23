import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Coupon } from "../models/coupon.model.js";


// GET /api/v1/admin/coupons — admin only (all coupons)
const getAllCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({}).sort({ createdAt: -1 });
  return res.status(200).json(
    new ApiResponse(200, coupons, "Coupons fetched successfully")
  );
});


// POST /api/v1/admin/coupons — admin only
const createCoupon = asyncHandler(async (req, res) => {
  const { code, discountPct, usageLimit, expiresAt } = req.body;

  if (!code || !code.trim()) {
    throw new ApiError(400, "Coupon code is required");
  }

  if (!discountPct || discountPct < 1 || discountPct > 100) {
    throw new ApiError(400, "Discount percentage must be between 1 and 100");
  }

  const existing = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (existing) {
    throw new ApiError(409, "Coupon code already exists");
  }

  const coupon = await Coupon.create({
    code:        code.trim().toUpperCase(),
    discountPct: Number(discountPct),
    usageLimit:  usageLimit ? Number(usageLimit) : 0,
    expiresAt:   expiresAt || null,
  });

  return res.status(201).json(
    new ApiResponse(201, coupon, "Coupon created successfully")
  );
});


// PATCH /api/v1/admin/coupons/:id/toggle — admin only
const toggleCouponActive = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const coupon = await Coupon.findById(id);
  if (!coupon) throw new ApiError(404, "Coupon not found");

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return res.status(200).json(
    new ApiResponse(200, coupon, `Coupon ${coupon.isActive ? "activated" : "deactivated"}`)
  );
});


// DELETE /api/v1/admin/coupons/:id — admin only
const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw new ApiError(404, "Coupon not found");

  return res.status(200).json(
    new ApiResponse(200, {}, "Coupon deleted successfully")
  );
});


// Internal helper — used by user.controllers.js applyCoupon
const validateCoupon = async (code) => {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

  if (!coupon) return null;

  // Check expiry
  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    return null;
  }

  // Check usage limit
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return null;
  }

  return coupon;
};


export { getAllCoupons, createCoupon, toggleCouponActive, deleteCoupon, validateCoupon };
