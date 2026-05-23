import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { ApiResponse } from "./utils/ApiResponse.js"


//CORS: allow karta hai frontend aur backend ko alag domain/port hote hue bhi baat karne me.
//cookie-parser: ek middleware hai jo client ke browser se aayi cookies ko easily read aur access karne deta hai.




const app = express()
// Yaha tum ek Express app ka instance bana rahe ho.
// app tumhara main object hai jisme tum routes, middlewares, aur server config add karte ho.


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))




app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true,limit: "16kb"}))

// kuch file public assest k liye rkhte hai 
app.use(express.static("public"))
app.use(cookieParser())




// routes import
import PingRouter from './routes/ping.routes.js'
import UserRouter from './routes/user.routes.js'
import AdminRouter from './routes/admin.routes.js'
import paymentRouter from './routes/payment.routes.js';
import messageRoutes from "./routes/message.routes.js";
import categoryRouter from "./routes/category.routes.js";
import bannerRouter from "./routes/banner.routes.js";
import couponRouter from "./routes/coupon.routes.js";
import { customerRouter as notifCustomerRouter, adminRouter as notifAdminRouter } from "./routes/notification.routes.js";

// routes declaration
app.use("/api/v1/users",UserRouter);
app.use("/api/v1/admin",AdminRouter);
app.use('/api/v1/payment', paymentRouter);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/banners", bannerRouter);
app.use("/api/v1/admin/coupons", couponRouter);
app.use("/api/v1/notifications", notifCustomerRouter);
app.use("/api/v1/admin/notifications", notifAdminRouter);
app.use("/api/v1/ping",PingRouter);



// Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json(
        new ApiResponse(statusCode, null, err.message || "Internal Server Error")
    );
});


export {app} 