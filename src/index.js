import dotenv from "dotenv"
dotenv.config({ path: "./.env" })

import dns from "dns"
dns.setServers(["1.1.1.1", "8.8.8.8"])

import connectDB from "./config/index.js"
import { connectRedis } from "./config/redis.js"
import http from "http";
import { app } from "./app.js";
import { initializeSocket } from "./socket.js";




// Async startup function
const startServer = async () => {
  try {
    // 1️⃣ Connect MongoDB
    await connectDB()
    console.log("✅ MongoDB Connected")

    // 2️⃣ Connect Redis
    await connectRedis()
    console.log("✅ Redis Connected")


    // 1. Express app ko raw HTTP server mein wrap karo
    const httpServer = http.createServer(app);

      // 2. Socket.io ko initialize karo using separated logic
    const io = await initializeSocket(httpServer);

    // 👇 YAHAN ADD KARO: Ab kisi bhi controller mein req.app.get("io") se socket mil jayega
    app.set("io", io);

    // 3️⃣ Handle app errors
    app.on("error", (error) => {
      console.error("❌ App Error:", error)
      throw error
    })

    // 4️⃣ Start server (YAHAN CHANGE KIYA HAI - app.listen ki jagah httpServer.listen)
    //     Socket.IO (via Engine.IO) needs to:

    // Intercept HTTP requests
    // Upgrade them to WebSocket
    // Manage persistent connections

    // 👉 Only the raw HTTP server can do this — not Express alone.


    const PORT = process.env.PORT || 8000

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running at port: ${PORT}`)
    })

  } catch (err) {
    console.error("❌ Server startup failed:", err)
    process.exit(1)
  }
}

startServer()
// (Neeche se extra httpServer.listen hata diya gaya hai)