import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js";
import { User }     from "../models/user.model.js"
import { Order } from "../models/order.models.js";
import { Admin } from "../models/admin.model.js";
import { Item } from "../models/item.model.js"
import { redisClient } from "../config/redis.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { Category } from "../models/category.model.js"
import { createAndEmitNotification } from "../utils/notification.helper.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";



// separate method because we will use it multiple places
const generateAccessAndRefreshToken = async (adminId) => {
    try {
        const admin = await Admin.findById(adminId);

        const accessToken  = admin.generateAccessToken();
        const refreshToken = admin.generateRefreshToken();
        admin.refreshToken = refreshToken;

        await admin.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
};






const sendOTP = asyncHandler(async (req, res) => {
    let { email } = req.body;

    if (!email) throw new ApiError(400, "Email is required");

    email = email.trim().toLowerCase();

    // Prevent sending OTP to non-existent admin
    const existingAdmin = await Admin.findOne({ email });
    if (!existingAdmin) throw new ApiError(404, "Admin not found");

    // Generate and store OTP in Redis
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.set(`otp:${email}`, otp, "EX", 300);

    // --- BREVO HTTP API INTEGRATION ---
    try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": process.env.BREVO_API_KEY, 
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: { 
                    name: "Hindustan IceCream", 
                    email: process.env.EMAIL_USER // This MUST be your verified sender email in Brevo
                },
                to: [{ email: email }],
                subject: "Your Hindustan IceCream Admin OTP",
                textContent: `Your OTP is ${otp}. It will expire in 5 minutes.`
            })
        });

        if (!brevoResponse.ok) {
            // If Brevo rejects the request (e.g., bad API key, unverified sender)
            const errorData = await brevoResponse.json();
            console.error("Brevo API Error:", errorData);
            throw new Error("Failed to send email via Brevo");
        }
    } catch (error) {
        console.error("Email sending failed:", error.message);
        throw new ApiError(500, "Could not send OTP email. Please try again later.");
    }

    res
      .status(200)
      .json(new ApiResponse(200, null, "OTP sent successfully"));
});





const loginAdmin = asyncHandler(async (req, res) => {

    let { email, password, otp } = req.body;

    if (!email || !password || !otp)
        throw new ApiError(400, "Email, password and OTP are required");

    email = email.trim().toLowerCase();

    // Find admin by email
    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin) throw new ApiError(401, "Invalid email");

    // Verify password
    const isMatch = await admin.isPasswordCorrect(String(password).trim());
    if (!isMatch) throw new ApiError(401, "Invalid password");

    // Verify OTP from Redis
    const storedOTP = await redisClient.get(`otp:${email}`);
    if (!storedOTP)        throw new ApiError(400, "OTP expired, please request a new one");
    if (storedOTP !== otp) throw new ApiError(400, "Invalid OTP");

    // Delete OTP after successful verification
    await redisClient.del(`otp:${email}`);

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(admin._id);

    const loggedInAdmin = await Admin.findById(admin._id).select("-refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("accessToken",  accessToken,  options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInAdmin,
                    accessToken,
                    refreshToken
                },
                "Admin Logged In Successfully"
            )
        );
});





const refreshAccessToken = asyncHandler(async (req, res) => {

    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!incomingRefreshToken)
            throw new ApiError(401, "Unauthorized request");

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const admin = await Admin.findById(decodedToken?._id);

        if (!admin)
            throw new ApiError(401, "Invalid refresh token");

        if (incomingRefreshToken !== admin?.refreshToken)
            throw new ApiError(401, "Refresh token is expired or used");

        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(admin._id);

        return res
            .status(200)
            .cookie("accessToken",  accessToken,  options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "Access token refreshed"
                )
            );

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});






const logoutAdmin = asyncHandler(async (req, res) => {

    await Admin.findByIdAndUpdate(
        req.admin._id,
        {
            $unset: { refreshToken: "" }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Admin logged out successfully"));
});





// const registerAdmin = asyncHandler(async (req, res) => {

//     let { email, password } = req.body;

//     if (!email || !password)
//         throw new ApiError(400, "Email and password are required");

//     email    = email.trim().toLowerCase();
//     password = await bcrypt.hash(String(password).trim(), 10);

//     // Check if admin already exists
//     const existingAdmin = await Admin.findOne({ email });
//     if (existingAdmin) throw new ApiError(409, "Admin already exists");

//     const admin = await Admin.create({ email, password });

//     const createdAdmin = await Admin.findById(admin._id).select("-refreshToken");
//     if (!createdAdmin) throw new ApiError(500, "Something went wrong while registering admin");

//     return res
//         .status(201)
//         .json(new ApiResponse(201, createdAdmin, "Admin registered successfully"));
// });





const uploadItem = asyncHandler(async (req, res) => {


    // 1. Check required fields
    const { name, description, category, price, rating, reviews, badge, isAvailable } = req.body;

    if (!name || !price) {
        throw new ApiError(400, "Name and price are required fields");
    }

    // Validate category exists in DB (admin must pre-create categories)
    if (category) {
        const catExists = await Category.findOne({
            $or: [
                { slug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") },
                { name: { $regex: new RegExp(`^${category}$`, "i") } }
            ]
        });
        if (!catExists) {
            throw new ApiError(400, `Category "${category}" does not exist. Please create it first from the Categories section.`);
        }
    }

    // 2. Get local file path from multer
    const imageLocalPath = req.files?.item[0]?.path;

    if (!imageLocalPath) {
        throw new ApiError(400, "Image file is required");
    }

    // 3. Upload to Cloudinary
    const uploadedImage = await uploadOnCloudinary(imageLocalPath);

    if (!uploadedImage?.url) {
        throw new ApiError(500, "Failed to upload image to Cloudinary");
    }

    // 4. Create new item in DB
    const item = await Item.create({
        name:        name.trim(),
        imageUrl:    uploadedImage.url,
        description: description?.trim() || '',
        category:    category || '',
        price:       Number(price),
        isAvailable: isAvailable !== undefined ? isAvailable === 'true' || isAvailable === true : true,
        rating:      rating ? Number(rating) : 0.0,
        reviews:     reviews || '0',
        badge:       badge?.trim() || '',
    });


    // 5. Send response
    return res.status(201).json(
        new ApiResponse(201, item, "Item uploaded successfully")
    );

});




const updateItem = asyncHandler(async (req, res) => {

  const { id } = req.params;

  const item = await Item.findById(id);
  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  const {
    name,
    description,
    category,
    price,
    rating,
    reviews,
    badge,
    isAvailable
  } = req.body;

  // Validate category exists if being updated
  if (category) {
    const catExists = await Category.findOne({
      $or: [
        { slug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") },
        { name: { $regex: new RegExp(`^${category}$`, "i") } }
      ]
    });
    if (!catExists) {
      throw new ApiError(400, `Category "${category}" does not exist. Please create it first from the Categories section.`);
    }
  }

  // ─── IMAGE (optional) ───────────────────────────────
  const imageLocalPath = req.files?.item?.[0]?.path;

  if (imageLocalPath) {
    const uploadedImage = await uploadOnCloudinary(imageLocalPath);

    if (!uploadedImage?.url) {
      throw new ApiError(500, "Image upload failed");
    }

    item.imageUrl = uploadedImage.url;
  }

  // ─── SAFE FIELD UPDATES ─────────────────────────────

  if (name !== undefined) {
    item.name = name.trim();
  }

  if (description !== undefined) {
    item.description = description.trim();
  }

  if (category !== undefined) {
    item.category = category;
  }

  if (price !== undefined) {
    item.price = Number(price);
  }

  if (rating !== undefined) {
    item.rating = Number(rating);
  }

  if (reviews !== undefined) {
    item.reviews = reviews;
  }

  if (badge !== undefined) {
    item.badge = badge.trim();
  }

  if (isAvailable !== undefined) {
    item.isAvailable = (isAvailable === 'true' || isAvailable === true);
  }

  // ─── SAVE ───────────────────────────────────────────
  await item.save();

  return res.status(200).json(
    new ApiResponse(200, item, "Item updated successfully")
  );
});



const loadItems = asyncHandler(async (req, res) => {

    const items = await Item.find({})

    if (!items) {
        throw new ApiError(404, "No items found")
    }

    return res.status(200).json(
        new ApiResponse(200, items, "Items fetched successfully")
    )
})




const deleteItem = asyncHandler(async (req, res) => {
    const { id } = req.params          // ✅ get id from URL

    const item = await Item.findByIdAndDelete(id)

    if (!item) {
        throw new ApiError(404, "Item not found")
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Item deleted successfully")
    )
})



const loadOrders = asyncHandler(async(req,res) => {

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        Order.find()
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Order.countDocuments(),
    ]);

    return res.status(200).json(
        new ApiResponse(200, {
            orders,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        }, "Orders fetched successfully")
    )
})




const loadAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo    = new Date(new Date().setFullYear(now.getFullYear() - 1));
 
  const [
    summaryAgg,
    byStatusAgg,
    byPaymentAgg,
    byMonthAgg,
    byYearAgg,
    byDayAgg,
    byHourAgg,
    byWeekdayAgg,
    topItemsAgg,
    byCategoryAgg,
  ] = await Promise.all([
 
    // ── Summary KPIs ──────────────────────────────────────────────────────
    Order.aggregate([{
      $facet: {
        // Revenue = all paid orders (any status)
        revenue: [
          { $match: { "payment.status": "paid" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
        ],
        // Cancelled count
        cancelled: [
          { $match: { status: "cancelled" } },
          { $count: "count" },
        ],
        // Paid count (for paidRate)
        paid: [
          { $match: { "payment.status": "paid" } },
          { $count: "count" },
        ],
        // Total orders (all, for rates)
        allOrders: [
          { $count: "count" },
        ],
      },
    }]),
 
    // ── By status (all orders) ────────────────────────────────────────────
    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
 
    // ── By payment status (all orders) ───────────────────────────────────
    Order.aggregate([
      { $group: { _id: "$payment.status", count: { $sum: 1 } } },
    ]),
 
    // ── Monthly revenue — last 12 months (paid orders only) ──────────────
    Order.aggregate([
      { $match: { "payment.status": "paid", createdAt: { $gte: oneYearAgo } } },
      { $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          orders:  { $sum: 1 },
      }},
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $project: {
          _id: 0,
          month: { $concat: [
            { $toString: "$_id.year" }, "-",
            { $cond: [{ $lt: ["$_id.month", 10] },
              { $concat: ["0", { $toString: "$_id.month" }] },
              { $toString: "$_id.month" }
            ]},
          ]},
          revenue: 1,
          orders:  1,
      }},
    ]),
 
    // ── Yearly revenue (paid orders only) ────────────────────────────────
    Order.aggregate([
      { $match: { "payment.status": "paid" } },
      { $group: {
          _id:     { $year: "$createdAt" },
          revenue: { $sum: "$totalAmount" },
          orders:  { $sum: 1 },
      }},
      { $sort: { "_id": 1 } },
      { $project: { _id: 0, year: "$_id", revenue: 1, orders: 1 } },
    ]),
 
    // ── Daily orders — last 30 days (ALL orders, no status filter) ───────
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
          _id:    { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
      }},
      { $sort: { "_id": 1 } },
      { $project: { _id: 0, date: "$_id", orders: 1 } },
    ]),
 
    // ── Orders by hour (ALL orders) ───────────────────────────────────────
    Order.aggregate([
      { $group: {
          _id:    { $hour: "$createdAt" },
          orders: { $sum: 1 },
      }},
      { $project: { _id: 0, hour: "$_id", orders: 1 } },
    ]),
 
    // ── Revenue by weekday (paid orders only) ─────────────────────────────
    Order.aggregate([
      { $match: { "payment.status": "paid" } },
      { $group: {
          _id:     { $dayOfWeek: "$createdAt" },
          revenue: { $sum: "$totalAmount" },
          orders:  { $sum: 1 },
      }},
      { $sort: { "_id": 1 } },
      { $project: {
          _id: 0,
          day: { $arrayElemAt: [["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "$_id"] },
          revenue: 1,
          orders:  1,
      }},
    ]),
 
    // ── Top items by revenue (paid orders only) ───────────────────────────
    Order.aggregate([
      { $match: { "payment.status": "paid" } },
      { $unwind: "$items" },
      { $group: {
          _id:      "$items.name",
          qty:      { $sum: "$items.qty" },
          revenue:  { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          category: { $first: "$items.category" },
      }},
      { $sort: { revenue: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, name: "$_id", qty: 1, revenue: 1, category: 1 } },
    ]),
 
    // ── Revenue by category (paid orders only) ────────────────────────────
    Order.aggregate([
      { $match: { "payment.status": "paid" } },
      { $unwind: "$items" },
      { $group: {
          _id:     "$items.category",
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
      }},
      { $sort: { revenue: -1 } },
      { $project: { _id: 0, category: "$_id", revenue: 1 } },
    ]),
  ]);
 
  // ── Build summary object ──────────────────────────────────────────────────
  const facet          = summaryAgg[0];
  const revData        = facet.revenue[0]   || { total: 0, count: 0 };
  const paidCount      = facet.paid[0]?.count      || 0;
  const cancelCount    = facet.cancelled[0]?.count || 0;
  const allOrdersCount = facet.allOrders[0]?.count || 0;
 
  const summary = {
    totalRevenue:  revData.total,
    totalOrders:   paidCount,                        // paid orders = "real" orders
    allOrders:     allOrdersCount,
    avgOrderValue: paidCount > 0 ? revData.total / paidCount : 0,
    paidRate:      allOrdersCount > 0 ? (paidCount      / allOrdersCount) * 100 : 0,
    cancelRate:    allOrdersCount > 0 ? (cancelCount    / allOrdersCount) * 100 : 0,
  };
 
  const byStatus = byStatusAgg.reduce(
    (acc, { _id, count }) => ({ ...acc, [_id]: count }),
    { pending: 0, confirmed: 0, delivered: 0, cancelled: 0 },
  );
 
  const byPayment = byPaymentAgg.reduce(
    (acc, { _id, count }) => ({ ...acc, [_id]: count }),
    { paid: 0, pending: 0, failed: 0 },
  );
 
  return res.status(200).json({
    success: true,
    data: {
      summary,
      byStatus,
      byPayment,
      byMonth:    byMonthAgg,
      byYear:     byYearAgg,
      byDay:      byDayAgg,
      byHour:     byHourAgg,
      byWeekday:  byWeekdayAgg,
      topItems:   topItemsAgg,
      byCategory: byCategoryAgg,
    },
  });
});
 
 





// controllers/admin.controller.js
const loadBuyers = asyncHandler(async (req, res) => {

    const users = await User.aggregate([
      // ── 1. Join orders ──────────────────────────────
      {
        $lookup: {
          from: "orders",           // your orders collection name
          localField: "_id",
          foreignField: "user",     // the field in Order that references User
          as: "orders"
        }
      },

      // ── 2. Add computed fields ───────────────────────
      {
        $addFields: {
          totalOrders: { $size: "$orders" },
          totalSpent: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$orders",
                    as: "o",
                    cond: { $ne: ["$$o.status", "cancelled"] }
                  }
                },
                as: "o",
                in: "$$o.totalAmount"
              }
            }
          },
          cancelledOrders: {
            $size: {
              $filter: {
                input: "$orders",
                as: "o",
                cond: { $eq: ["$$o.status", "cancelled"] }
              }
            }
          },
          deliveredOrders: {
            $size: {
              $filter: {
                input: "$orders",
                as: "o",
                cond: { $eq: ["$$o.status", "delivered"] }
              }
            }
          }
        }
      },

      // ── 3. Remove sensitive fields ───────────────────
      {
        $project: {
          password: 0,
          refreshToken: 0
        }
      },

      // ── 4. Sort: newest users first ──────────────────
      { $sort: { createdAt: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      data: users
    });

});





// ── Block user ─────────────────────────────────────────────────
const blockUser = asyncHandler(async (req, res) => {

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true, select: "-password -refreshToken" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ success: true, data: user });

  });




// ── Unblock user ───────────────────────────────────────────────
const unblockUser = asyncHandler(async (req, res) => {

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true, select: "-password -refreshToken" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ success: true, data: user });

  });





// ── Flag / unflag fraud ────────────────────────────────────────
const setFraudFlag = asyncHandler(async (req, res) => {
    const { isFraud } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isFraud },
      { new: true, select: "-password -refreshToken" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ success: true, data: user });
});




// ── Update Order Status ────────────────────────────────────────
// PATCH /api/v1/admin/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const order = await Order.findById(id).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");

  const previousStatus = order.status;
  order.status = status;
  await order.save();

  // Emit real-time notification to the customer
  const io = req.app.get("io");
  if (io && order.user?._id) {
    const typeMap = {
      confirmed: "order_confirmed",
      delivered: "order_delivered",
      cancelled: "order_cancelled",
      pending: "order_placed",
    };
    const titleMap = {
      confirmed: "Order Confirmed! ✅",
      delivered: "Order Delivered! 🚀",
      cancelled: "Order Cancelled ❌",
      pending: "Order Status Updated",
    };
    const messageMap = {
      confirmed: `Your order #${order._id.toString().slice(-8).toUpperCase()} has been confirmed and is being prepared!`,
      delivered: `Your order #${order._id.toString().slice(-8).toUpperCase()} has been delivered. Enjoy your ice cream! 🍦`,
      cancelled: `Your order #${order._id.toString().slice(-8).toUpperCase()} has been cancelled.`,
      pending: `Your order #${order._id.toString().slice(-8).toUpperCase()} status was updated to pending.`,
    };

    await createAndEmitNotification(io, {
      userId: order.user._id,
      userType: "customer",
      type: typeMap[status],
      title: titleMap[status],
      message: messageMap[status],
      orderId: order._id,
    });
  }

  return res.status(200).json(
    new ApiResponse(200, order, `Order status updated from ${previousStatus} to ${status}`)
  );
});




// ── Broadcast notification to all users ────────────────────────────────
const broadcastNotification = asyncHandler(async (req, res) => {
    const { title, message, type = "broadcast" } = req.body;
    if (!title || !message) throw new ApiError(400, "Title and message are required");

    const users = await User.find({ isBlocked: false }, "_id").lean();
    const io = req.app.get("io");

    const batchSize = 50;
    let sent = 0;
    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await Promise.allSettled(
            batch.map(user =>
                createAndEmitNotification(io, {
                    userId: user._id,
                    userType: "customer",
                    type,
                    title,
                    message,
                })
            )
        );
        sent += batch.length;
    }

    return res.status(200).json(
        new ApiResponse(200, { sent }, `Broadcast sent to ${sent} users`)
    );
});


// ── Send targeted notification by email ────────────────────────────────
const sendTargetedNotification = asyncHandler(async (req, res) => {
    const { email, title, message, type = "system" } = req.body;
    if (!email || !title || !message) throw new ApiError(400, "Email, title, and message are required");

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new ApiError(404, "User not found with that email");

    const io = req.app.get("io");
    await createAndEmitNotification(io, {
        userId: user._id,
        userType: "customer",
        type,
        title,
        message,
    });

    return res.status(200).json(
        new ApiResponse(200, {}, "Notification sent successfully")
    );
});



export {
        sendOTP,
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
}
