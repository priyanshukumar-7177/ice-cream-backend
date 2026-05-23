import { Router } from "express";
import {
        sendOTP,
        registerAdmin,
        loginAdmin,
        refreshAccessToken,
        logoutAdmin,
        uploadItem,
        updateItem,
        loadItems,
        deleteItem,
        loadOrders,
        loadAnalytics,
        loadBuyers,
        blockUser,
        unblockUser,
        setFraudFlag,
        updateOrderStatus,
        broadcastNotification,
        sendTargetedNotification
        } from "../controllers/admin.controllers.js";

import { AdminVerifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js"

const router = Router();



router.route("/send-otp").post(sendOTP);
router.route("/register").post(registerAdmin);
router.route("/login").post(loginAdmin);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/logout").post(AdminVerifyJWT,logoutAdmin);

router.route("/upload-item").post(
    AdminVerifyJWT,
        upload.fields([
        {
            name: "item",
            maxCount: 1
        }

        ]),
    uploadItem
)

router.route("/edit-item/:id").patch(
  AdminVerifyJWT,
  upload.fields([{ name: "item", maxCount: 1 }]),
  updateItem
);

router.route("/load-items").get(AdminVerifyJWT, loadItems)

router.route("/delete-item/:id").delete(AdminVerifyJWT, deleteItem)


router.route("/load-orders").get(AdminVerifyJWT, loadOrders);
router.route("/load-analytics").get(AdminVerifyJWT, loadAnalytics);

// Order status update — the critical missing route
router.patch("/orders/:id/status", AdminVerifyJWT, updateOrderStatus);

router.get("/load-buyers",           AdminVerifyJWT, loadBuyers);
router.patch("/users/:id/block",     AdminVerifyJWT, blockUser);
router.patch("/users/:id/unblock",   AdminVerifyJWT, unblockUser);
router.patch("/users/:id/fraud",     AdminVerifyJWT, setFraudFlag);

router.route("/broadcast-notification").post(AdminVerifyJWT, broadcastNotification);
router.route("/send-notification").post(AdminVerifyJWT, sendTargetedNotification);

export default router;