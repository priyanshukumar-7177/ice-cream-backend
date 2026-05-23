import mongoose from "mongoose";

// ─── Cart Item ─────────────────────────────────────────
const cartItemSchema = new mongoose.Schema(
  {
    itemId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Item", 
      required: true 
    },

    nameAtAdd: { type: String, required: true },   // ✅ snapshot
    priceAtAdd: { type: Number, required: true },  // ✅ snapshot

    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

// ─── Pricing ───────────────────────────────────────────
const pricingSchema = new mongoose.Schema(
  {
    rawTotal:    { type: Number, default: 0 },
    discountAmt: { type: Number, default: 0 },
    finalTotal:  { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Address ───────────────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    city:  { type: String, required: true },
    pin:   { type: String, required: true },
    state: { type: String, required: true },
  },
  { _id: false }
);

// ─── Cart ──────────────────────────────────────────────
const cartSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      unique: true
    },

    items: { type: [cartItemSchema], default: [] },

    pricing: { type: pricingSchema, default: {} },

    coupon: {
      code: String,
      discountPct: Number,
    },

    deliveryAddress: { type: addressSchema, default: null },

    status: {
      type: String,
      enum: ["active", "checked_out"],
      default: "active",
    },
  },
  { timestamps: true }
);

// TTL removed — active carts should NOT auto-expire
// Cart cleanup should be handled manually or via scheduled job if needed

const Cart = mongoose.model("Cart", cartSchema);
export { Cart };