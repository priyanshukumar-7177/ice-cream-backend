import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "image"],
      default: "image",
    },
    imageUrl: {
      type: String,
    },
    title: {
      type: String,
      default: "",
    },
    subtitle: {
      type: String,
      default: "",
    },
    ctaText: {
      type: String,
      default: "Shop Now →",
    },
    ctaLink: {
      type: String,
      default: "#",
    },
    tagText: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for efficient querying of active banners sorted by order
bannerSchema.index({ isActive: 1, sortOrder: 1 });

const Banner = mongoose.model("Banner", bannerSchema);

export { Banner };
