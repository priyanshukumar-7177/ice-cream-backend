import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Banner } from "../models/banner.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


// GET /api/v1/banners — public (homepage carousel)
const getActiveBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1 });
  return res.status(200).json(
    new ApiResponse(200, banners, "Active banners fetched")
  );
});


// GET /api/v1/admin/banners — admin only (ALL banners)
const getAllBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({}).sort({ sortOrder: 1, createdAt: -1 });
  return res.status(200).json(
    new ApiResponse(200, banners, "All banners fetched")
  );
});


// POST /api/v1/admin/banners — admin only
const uploadBanner = asyncHandler(async (req, res) => {
  const { title, subtitle, ctaText, ctaLink, tagText, sortOrder, type } = req.body;
  const bannerType = type === 'text' ? 'text' : 'image';

// In uploadBanner controller — replace the image block with this:
let uploadedImageUrl = "";

if (bannerType === "image") {
  const imageLocalPath = req.files?.banner?.[0]?.path;
  if (!imageLocalPath) {
    throw new ApiError(400, "Banner image is required for image type banner");
  }
  const uploadedImage = await uploadOnCloudinary(imageLocalPath);
  if (!uploadedImage?.url) {
    throw new ApiError(500, "Failed to upload banner image to Cloudinary");
  }
  uploadedImageUrl = uploadedImage.url;
}
// For text banners, imageUrl stays "" — this is already correct ✓

  const banner = await Banner.create({
    type:      bannerType,
    imageUrl:  uploadedImageUrl,
    title:     title?.trim() || "",
    subtitle:  subtitle?.trim() || "",
    ctaText:   ctaText?.trim() || "Shop Now →",
    ctaLink:   ctaLink?.trim() || "#",
    tagText:   tagText?.trim() || "",
    sortOrder: sortOrder ? Number(sortOrder) : 0,
  });

  return res.status(201).json(
    new ApiResponse(201, banner, "Banner uploaded successfully")
  );
});


// PATCH /api/v1/admin/banners/:id — admin only
const updateBanner = asyncHandler(async (req, res) => {

  // ADD THIS LINE TEMPORARILY
  console.log("BODY:", req.body, "FILES:", req.files);
  
  const { id } = req.params;

  const banner = await Banner.findById(id);
  if (!banner) throw new ApiError(404, "Banner not found");

  const { title, subtitle, ctaText, ctaLink, tagText, sortOrder, isActive, type } = req.body;

  if (type) banner.type = type;

  // Optional new image upload for image type
  if (banner.type === 'image') {
    const imageLocalPath = req.files?.banner?.[0]?.path;
    if (imageLocalPath) {
      const uploadedImage = await uploadOnCloudinary(imageLocalPath);
      if (!uploadedImage?.url) throw new ApiError(500, "Image upload failed");
      banner.imageUrl = uploadedImage.url;
    }
  } else if (banner.type === 'text') {
    banner.imageUrl = ""; // Clear image for text banner
  }

  if (title !== undefined)     banner.title = title.trim();
  if (subtitle !== undefined)  banner.subtitle = subtitle.trim();
  if (ctaText !== undefined)   banner.ctaText = ctaText.trim();
  if (ctaLink !== undefined)   banner.ctaLink = ctaLink.trim();
  if (tagText !== undefined)   banner.tagText = tagText.trim();
  if (sortOrder !== undefined) banner.sortOrder = Number(sortOrder);
  if (isActive !== undefined)  banner.isActive = isActive === true || isActive === "true";

  await banner.save();

  return res.status(200).json(
    new ApiResponse(200, banner, "Banner updated successfully")
  );
});


// PATCH /api/v1/admin/banners/:id/toggle — admin only (quick toggle)
const toggleBannerActive = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const banner = await Banner.findById(id);
  if (!banner) throw new ApiError(404, "Banner not found");

  banner.isActive = !banner.isActive;
  await banner.save();

  return res.status(200).json(
    new ApiResponse(200, banner, `Banner ${banner.isActive ? "activated" : "deactivated"}`)
  );
});


// DELETE /api/v1/admin/banners/:id — admin only
const deleteBanner = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const banner = await Banner.findByIdAndDelete(id);
  if (!banner) throw new ApiError(404, "Banner not found");

  return res.status(200).json(
    new ApiResponse(200, {}, "Banner deleted successfully")
  );
});


export {
  getActiveBanners,
  getAllBanners,
  uploadBanner,
  updateBanner,
  toggleBannerActive,
  deleteBanner,
};
