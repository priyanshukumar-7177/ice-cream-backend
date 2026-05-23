import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    imageUrl:    { type: String, default: '' },
    description: { type: String, default: '' },
    category:    { type: String, default: '' },
    price:       { type: Number, required: true, min: 0 },
    isAvailable: { type: Boolean, default: true },
    rating:      { type: Number, default: 0 },
    reviews:     { type: String, default: '0' },   // "2.4k" format
    badge:       { type: String, default: '' },
  },
  { timestamps: true }
);

const Item = mongoose.model('Item', itemSchema);

export { Item };