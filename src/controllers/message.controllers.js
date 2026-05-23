import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { redisClient } from "../config/redis.js"; 

// ==========================================
// 1️⃣ Send Message API
// ==========================================
const sendMessage = async (req, res) => {
    try {
        const { receiverId } = req.params; 
        const { content } = req.body;      
        const senderId = req.user._id;     

        if (!content) return res.status(400).json({ error: "Message content is required" });

        const newMessage = await Message.create({
            senderId,
            receiverId,
            content
        });

        const receiverSocketId = await redisClient.get(receiverId.toString());

        if (receiverSocketId) {
            const io = req.app.get("io"); 
            io.to(receiverSocketId).emit("receive_message", newMessage);
        }

        return res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
        console.error("Error in sendMessage API:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================================
// 2️⃣ Get Chat History API (Yeh missing tha!)
// ==========================================
const getChatHistory = async (req, res) => {
    try {
        const { chatWithUserId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: chatWithUserId },
                { senderId: chatWithUserId, receiverId: myId }
            ]
        }).sort({ createdAt: 1 }); 

        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        console.error("Error in getChatHistory API:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// ==========================================
// 3️⃣ Search Users API (Email Only)
// ==========================================
const searchUsers = async (req, res) => {
    try {
        const keyword = req.query.search; 

        if (!keyword) {
            return res.status(200).json({ data: [] });
        }

        const users = await User.find({
            $and: [
                { email: { $regex: keyword, $options: "i" } }, 
                { _id: { $ne: req.user._id } } 
            ]
        }).select("-password"); 

        return res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error("Error in search:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};


// message.controller.js mein add karein:

const getRecentChats = async (req, res) => {
    try {
        const myId = req.user._id;

        // Find all distinct users you have sent messages to OR received messages from
        const sentMessages = await Message.distinct("receiverId", { senderId: myId });
        const receivedMessages = await Message.distinct("senderId", { receiverId: myId });

        // Combine arrays and remove duplicates & own ID
        const userIds = [...new Set([...sentMessages, ...receivedMessages])]
            .filter(id => id.toString() !== myId.toString());

        // Fetch User details for sidebar
        const users = await User.find({ _id: { $in: userIds } }).select("name email");

        return res.status(200).json({ success: true, data: users });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Teeno functions ko ek sath export kar diya
export { sendMessage, getChatHistory, searchUsers ,getRecentChats};