import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
} from "../controllers/notification.controllers.js";
import { verifyJWT, AdminVerifyJWT } from "../middlewares/auth.middleware.js";

const customerRouter = Router();
const adminRouter = Router();

// Customer notification routes (uses verifyJWT → req.user)
customerRouter.get("/", verifyJWT, getNotifications);
customerRouter.get("/unread", verifyJWT, getUnreadCount);
customerRouter.patch("/:id/read", verifyJWT, markAsRead);
customerRouter.patch("/read-all", verifyJWT, markAllRead);

// Admin notification routes (uses AdminVerifyJWT → req.admin)
adminRouter.get("/", AdminVerifyJWT, getNotifications);
adminRouter.get("/unread", AdminVerifyJWT, getUnreadCount);
adminRouter.patch("/:id/read", AdminVerifyJWT, markAsRead);
adminRouter.patch("/read-all", AdminVerifyJWT, markAllRead);

export { customerRouter, adminRouter };
