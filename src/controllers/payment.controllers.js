import { asyncHandler }  from "../utils/asyncHandler.js";
import { ApiResponse }   from "../utils/ApiResponse.js";
import { ApiError }      from "../utils/ApiError.js";
import { Order }         from "../models/order.models.js";
import { Cart }          from "../models/cart.model.js";
import razorpay          from "../config/razorpay.js";
import { validatePaymentVerification, validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils.js";
import crypto            from "crypto";
import { createAndEmitNotification, notifyAllAdmins } from "../utils/notification.helper.js";



// POST /api/payment/create-order
const createOrder = asyncHandler(async (req, res) => {

  const userId = req.user._id;

  const { deliveryAddress } = req.body;

  const cart = await Cart.findOne({ userId });

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ success: false, message: "Cart is empty" });
  }

  if (!deliveryAddress) {
    return res.status(400).json({ 
      success: false, 
      message: "Please add a delivery address before checkout" 
    });
  }

  const totalAmount = cart.pricing?.finalTotal || cart.pricing?.rawTotal;

  if (!totalAmount || totalAmount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid cart total" });
  }

  // Idempotency: check if there's already a pending unpaid order for this user's cart
  const existingPendingOrder = await Order.findOne({
    user: userId,
    "payment.status": "pending",
    status: "pending",
    totalAmount: totalAmount,
  }).sort({ createdAt: -1 });

  if (existingPendingOrder && existingPendingOrder.razorpay?.orderId) {
    // Return existing Razorpay order to avoid creating duplicates
    try {
      const existingRzpOrder = await razorpay.orders.fetch(existingPendingOrder.razorpay.orderId);
      if (existingRzpOrder.status === "created") {
        return res.json({
          success: true,
          order_id: existingRzpOrder.id,
          amount: existingRzpOrder.amount,
          currency: existingRzpOrder.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          db_order_id: existingPendingOrder._id,
        });
      }
    } catch {
      // If fetch fails, create a new order below
    }
  }

  const options = {
    amount: Math.round(totalAmount * 100),
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: {
      userId: userId.toString(),
    },
  };

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create(options);
  } catch (err) {
    console.error("Razorpay order creation failed:", err?.error?.description || err.message);
    throw new ApiError(502, "Payment gateway error. Please try again.");
  }

  const orderItems = cart.items.map((item) => ({
    itemId:   item.itemId,
    name:     item.nameAtAdd,
    price:    item.priceAtAdd,
    qty:      item.qty,
  }));

  const order = await Order.create({
    user:            userId,
    items:           orderItems,
    totalAmount,
    deliveryAddress,
    status:          "pending",
    payment: {
      status: "pending",
    },
    razorpay: {
      orderId: razorpayOrder.id,
    },
  });

  res.json({
    success:     true,
    order_id:    razorpayOrder.id,
    amount:      razorpayOrder.amount,
    currency:    razorpayOrder.currency,
    key_id:      process.env.RAZORPAY_KEY_ID,
    db_order_id: order._id,
  });
});



// POST /api/payment/verify
const paymentVerify = asyncHandler(async (req, res) => {

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing payment verification parameters");
  }

  const isValid = validatePaymentVerification(
    { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
    razorpay_signature,
    process.env.RAZORPAY_KEY_SECRET
  );

  if (!isValid) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const order = await Order.findOne({ "razorpay.orderId": razorpay_order_id });

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Idempotency check
  if (order.payment.status === "paid") {
    return res.json({ success: true, message: "Already verified", orderId: order._id });
  }

  order.payment.status       = "paid";
  order.payment.transactionId = razorpay_payment_id;
  order.razorpay.paymentId   = razorpay_payment_id;
  order.razorpay.signature   = razorpay_signature;
  order.status               = "confirmed";

  await order.save();

  await Cart.findOneAndUpdate(
    { userId: req.user._id },
    { items: [], pricing: {}, status: "active" }
  );

  // Emit notifications
  const io = req.app.get("io");
  if (io) {
    // Notify customer: payment success
    await createAndEmitNotification(io, {
      userId: req.user._id,
      userType: "customer",
      type: "payment_success",
      title: "Payment Successful! 🎉",
      message: `Your payment of ₹${order.totalAmount} has been confirmed. Order #${order._id.toString().slice(-8).toUpperCase()} is being prepared!`,
      orderId: order._id,
    });

    // Notify all admins: new paid order
    await notifyAllAdmins(io, {
      type: "order_placed",
      title: "New Order Received! 📦",
      message: `New paid order #${order._id.toString().slice(-8).toUpperCase()} for ₹${order.totalAmount}`,
      orderId: order._id,
    });
  }

  res.json({ success: true, message: "Payment verified successfully", orderId: order._id });
});



// POST /api/payment/webhook
const webhook = asyncHandler(async (req, res) => {

  const webhookSignature = req.headers["x-razorpay-signature"];
  const webhookBody      = req.body;

  if (!webhookSignature || !webhookBody) {
    return res.status(400).json({ success: false, message: "Missing webhook data" });
  }

  let isValid = false;
  try {
    // Use timing-safe comparison via the Razorpay utility
    isValid = validateWebhookSignature(
      webhookBody.toString(),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature validation error:", err.message);
    return res.status(400).json({ success: false });
  }

  if (!isValid) {
    console.error("Invalid webhook signature");
    return res.status(400).json({ success: false });
  }

  let event;
  try {
    event = JSON.parse(webhookBody.toString());
  } catch (err) {
    console.error("Webhook body parse error:", err.message);
    return res.status(400).json({ success: false, message: "Malformed payload" });
  }

  const io = req.app.get("io");

  switch (event.event) {

    case "payment.captured": {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const order = await Order.findOne({ "razorpay.orderId": orderId });

      if (!order) break;
      if (order.payment.status === "paid") break;   // idempotency

      order.payment.status        = "paid";
      order.payment.transactionId = payment.id;
      order.razorpay.paymentId    = payment.id;
      order.status                = "confirmed";

      await order.save();

      await Cart.findOneAndUpdate(
        { userId: order.user },
        { items: [], pricing: {}, status: "active" }
      );

      // Notify customer
      if (io) {
        await createAndEmitNotification(io, {
          userId: order.user,
          userType: "customer",
          type: "payment_success",
          title: "Payment Confirmed! 🎉",
          message: `Your order #${order._id.toString().slice(-8).toUpperCase()} payment has been captured.`,
          orderId: order._id,
        });

        await notifyAllAdmins(io, {
          type: "order_placed",
          title: "New Paid Order! 📦",
          message: `Order #${order._id.toString().slice(-8).toUpperCase()} - ₹${order.totalAmount} payment captured via webhook`,
          orderId: order._id,
        });
      }

      console.log(`✅ Order ${orderId} marked PAID via webhook`);
      break;
    }

    case "payment.failed": {
      const payment = event.payload.payment.entity;

      const order = await Order.findOneAndUpdate(
        { "razorpay.orderId": payment.order_id },
        { "payment.status": "failed", status: "cancelled" },
        { new: true }
      );

      // Notify customer of payment failure
      if (io && order) {
        await createAndEmitNotification(io, {
          userId: order.user,
          userType: "customer",
          type: "payment_failed",
          title: "Payment Failed ❌",
          message: `Your payment for order #${order._id.toString().slice(-8).toUpperCase()} has failed. Please try again.`,
          orderId: order._id,
        });
      }

      console.log(`❌ Payment failed for order ${payment.order_id}`);
      break;
    }

    default:
      console.log(`Unhandled event: ${event.event}`);
  }

  res.status(200).json({ received: true });
  
});



export { createOrder, paymentVerify, webhook };