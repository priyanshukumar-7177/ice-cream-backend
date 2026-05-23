import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisClient } from "./config/redis.js";

export const initializeSocket = async (httpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.CORS_ORIGIN || "*", credentials: true }
    });

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("No token provided"));
            const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            socket.user = decodedToken;
            next();
        } catch (error) {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        const userId = socket.user._id.toString();
        const userRole = socket.user.role || "customer";
        console.log(`🟢 ${userRole} connected: ${socket.id} (DB_ID: ${userId})`);

        // 1. Map user to socket ID in Redis
        await redisClient.set(userId, socket.id);
        
        // 2. Admin users join the admin room for broadcast notifications
        if (userRole === "admin") {
            socket.join("room:admin");
        }

        // Broadcast to everyone that this user is now online
        socket.broadcast.emit("user_status_changed", { userId, status: "online" });

        // ==========================================
        // REAL-TIME EVENT HANDLERS
        // ==========================================

        // A. Check if a user is online
        socket.on("check_online_status", async (checkUserId, callback) => {
            const isOnline = await redisClient.get(checkUserId.toString());
            callback(!!isOnline); 
        });

        // B. Typing Started
        socket.on("typing_started", async ({ receiverId }) => {
            const receiverSocketId = await redisClient.get(receiverId.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("friend_typing", { senderId: userId });
            }
        });

        // C. Typing Stopped
        socket.on("typing_stopped", async ({ receiverId }) => {
            const receiverSocketId = await redisClient.get(receiverId.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("friend_stopped_typing", { senderId: userId });
            }
        });

        // D. Mark notification as read (real-time sync)
        socket.on("notification:read", async (notificationId) => {
            try {
                const { Notification } = await import("./models/notification.model.js");
                await Notification.findOneAndUpdate(
                    { _id: notificationId, userId },
                    { isRead: true }
                );
            } catch (err) {
                console.error("notification:read error:", err.message);
            }
        });

        // ==========================================

        socket.on("disconnect", async () => {
            console.log(`🔴 ${userRole} disconnected: ${socket.id}`);
            await redisClient.del(userId);
            socket.broadcast.emit("user_status_changed", { userId, status: "offline" });
        });
    });

    return io;
};