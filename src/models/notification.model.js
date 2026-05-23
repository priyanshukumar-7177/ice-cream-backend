import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ["customer", "admin"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "order_placed",
        "order_confirmed",
        "order_delivered",
        "order_cancelled",
        "payment_success",
        "payment_failed",
        "system",
        "promo",
        "broadcast",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 7-day TTL — MongoDB automatically deletes documents after 604800 seconds
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 6652800 });

// Compound index for efficient per-user queries
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export { Notification };
