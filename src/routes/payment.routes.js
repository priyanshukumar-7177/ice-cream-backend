import express from "express";
import { createOrder, paymentVerify, webhook } from "../controllers/payment.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// ✅ Webhook — override with raw body parser
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhook
);

// ✅ These work fine with global express.json()
router.post("/create-order", verifyJWT, createOrder);
router.post("/verify",       verifyJWT, paymentVerify);

export default router;