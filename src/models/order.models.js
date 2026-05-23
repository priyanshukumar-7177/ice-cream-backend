import mongoose from "mongoose";

// ─── Order Item Snapshot ───────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    itemId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Item", 
      required: true 
    },

    name:  { type: String, required: true },
    price: { type: Number, required: true },
    qty:   { type: Number, required: true },
  },
  { _id: false }
);

// ─── Address Snapshot ──────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    name:  String,
    phone: String,
    line1: String,
    line2: String,
    city:  String,
    pin:   String,
    state: String,
  },
  { _id: false }
);

// ─── Order ─────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    items: { type: [orderItemSchema], required: true },

    totalAmount: { type: Number, required: true },

    deliveryAddress: { type: addressSchema, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "cancelled"],
      default: "pending",
    },

    payment: {
      status: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending",
      },

      transactionId: {
        type: String,
      },
    },

    razorpay: {
      orderId:   { type: String, required: true },
      paymentId: { type: String },
      signature: { type: String },
    },
  },
  { timestamps: true }
);

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });

// Idempotency protection
orderSchema.index(
  { "payment.transactionId": 1 },
  { unique: true, sparse: true }
);

const Order = mongoose.model("Order", orderSchema);
export { Order };
