import { Notification } from "../models/notification.model.js";
import { Admin } from "../models/admin.model.js";
import { redisClient } from "../config/redis.js";

/**
 * Create a notification in DB and emit it via Socket.io if the user is online.
 *
 * @param {import("socket.io").Server} io - Socket.io server instance
 * @param {Object} opts
 * @param {string} opts.userId    - Target user's DB _id
 * @param {string} opts.userType  - "customer" or "admin"
 * @param {string} opts.type      - Notification type enum value
 * @param {string} opts.title     - Short title
 * @param {string} opts.message   - Notification body
 * @param {string} [opts.orderId] - Related order ID (optional)
 */
export const createAndEmitNotification = async (io, { userId, userType, type, title, message, orderId }) => {
  try {
    // 1. Persist to database
    const notification = await Notification.create({
      userId,
      userType,
      type,
      title,
      message,
      orderId: orderId || undefined,
    });

    // 2. Try to emit in real-time if user is online
    const socketId = await redisClient.get(userId.toString());
    if (socketId && io) {
      io.to(socketId).emit("new_notification", notification);
    }

    return notification;
  } catch (error) {
    console.error("Notification helper error:", error);
    // Don't throw — notifications should not break main flows
    return null;
  }
};


/**
 * Emit a notification to ALL online admins.
 * Used for events like "new order placed".
 */
export const notifyAllAdmins = async (io, { type, title, message, orderId }) => {
  try {
    // 1. Find all admin IDs
    const admins = await Admin.find({}, "_id").lean();

    // 2. Create a notification for each admin + emit if online
    const promises = admins.map(admin =>
      createAndEmitNotification(io, {
        userId: admin._id,
        userType: "admin",
        type,
        title,
        message,
        orderId,
      })
    );

    await Promise.allSettled(promises);
  } catch (error) {
    console.error("notifyAllAdmins error:", error);
  }
};
