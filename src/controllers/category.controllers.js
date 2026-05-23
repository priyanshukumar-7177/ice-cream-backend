import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Category } from "../models/category.model.js";


// GET /api/v1/categories — public
const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  return res.status(200).json(
    new ApiResponse(200, categories, "Categories fetched successfully")
  );
});


// POST /api/v1/admin/categories — admin only
const createCategory = asyncHandler(async (req, res) => {
  const { name, emoji } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, "Category name is required");
  }

  const existing = await Category.findOne({
    name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
  });
  if (existing) {
    throw new ApiError(409, "Category already exists");
  }

  const category = await Category.create({
    name: name.trim(),
    emoji: emoji?.trim() || "🍦",
  });

  return res.status(201).json(
    new ApiResponse(201, category, "Category created successfully")
  );
});


// PATCH /api/v1/admin/categories/:id — admin only
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, emoji, isActive } = req.body;

  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Category not found");

  if (name !== undefined) category.name = name.trim();
  if (emoji !== undefined) category.emoji = emoji.trim();
  if (isActive !== undefined) category.isActive = isActive;

  await category.save();

  return res.status(200).json(
    new ApiResponse(200, category, "Category updated successfully")
  );
});


// DELETE /api/v1/admin/categories/:id — admin only
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, "Category not found");

  return res.status(200).json(
    new ApiResponse(200, {}, "Category deleted successfully")
  );
});


export { getAllCategories, createCategory, updateCategory, deleteCategory };
