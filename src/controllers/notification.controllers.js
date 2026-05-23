import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Notification } from "../models/notification.model.js";


// GET /api/v1/notifications — auth required
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.admin?._id;
  if (!userId) throw new ApiError(401, "Authentication required");

  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.status(200).json(
    new ApiResponse(200, notifications, "Notifications fetched")
  );
});


// GET /api/v1/notifications/unread — auth required
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.admin?._id;
  if (!userId) throw new ApiError(401, "Authentication required");

  const count = await Notification.countDocuments({ userId, isRead: false });

  return res.status(200).json(
    new ApiResponse(200, { count }, "Unread count fetched")
  );
});


// PATCH /api/v1/notifications/:id/read — auth required
const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.admin?._id;
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) throw new ApiError(404, "Notification not found");

  return res.status(200).json(
    new ApiResponse(200, notification, "Marked as read")
  );
});


// PATCH /api/v1/notifications/read-all — auth required
const markAllRead = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.admin?._id;

  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  return res.status(200).json(
    new ApiResponse(200, {}, "All notifications marked as read")
  );
});


export { getNotifications, getUnreadCount, markAsRead, markAllRead };
