import { Router } from "express";
import { sendMessage, getChatHistory, searchUsers ,getRecentChats} from "../controllers/message.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"; 

const router = Router();

// In routes par bina login ke koi nahi aa sakta
router.use(verifyJWT);

// API Routes
router.post("/send/:receiverId", sendMessage);
router.get("/history/:chatWithUserId", getChatHistory);

// 👇 YAHAN INCLUDE KIYA: Search User ka route
router.get("/search", searchUsers);
router.get("/recent", getRecentChats);

export default router;