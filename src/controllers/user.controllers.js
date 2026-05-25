import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Order } from "../models/order.models.js";
import { Item } from "../models/item.model.js";
import { Cart } from "../models/cart.model.js"
import { Coupon } from "../models/coupon.model.js"
import bcrypt from "bcrypt";
import { Otp } from "../models/otp.model.js";
import nodemailer from "nodemailer"; // optional if sending email
import jwt from "jsonwebtoken";




// separate method because we will use it multiple places
const generateAccessAndRefreshToken = async(userId)=>{

    try{
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false })

        return {
            accessToken,
            refreshToken
        }

    }catch(error){
        throw new ApiError(500,"something went wrong while generating refresh and access token")
    }

}





const sendOTP = asyncHandler(async (req, res) => {
    let { email } = req.body;

    if (!email) throw new ApiError(400, "Email is required");

    email = email.trim().toLowerCase();

    // 1. UPDATED: Check the User collection instead of Admin
    const existingUser = await User.findOne({ email });
    if (!existingUser) throw new ApiError(404, "User not found");

    // Generate and store OTP in Redis
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 2. UPDATED: Changed the Redis key to 'user-otp:' to avoid mixing up admin and user OTPs
    await redisClient.set(`user-otp:${email}`, otp, "EX", 300);

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
                // 3. UPDATED: Changed the email subject line
                subject: "Your Hindustan IceCream Login OTP",
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




const AuthsendOTP = asyncHandler(async (req, res) => {

    const user = await User.findById(req.user._id).select("email");

    const email = req.user.email.trim();

    if (!email) throw new ApiError(400, "Auth ka error hai");


    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate({ email }, { email, otp, createdAt: new Date() }, { upsert: true });

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your Hindustan IceCream OTP",
        text: `Your OTP is ${otp}. It will expire in 5 minutes.`
    });

    res
      .status(200)
      .json(new ApiResponse(200, null, "OTP sent successfully"));
});



 const registerUser = asyncHandler(async (req, res) => {

    const { name, email, password, confirmPassword, otp } = req.body;

    if (!name || !email || !password || !confirmPassword || !otp)
        throw new ApiError(400, "All fields are required");

    if (password !== confirmPassword)
        throw new ApiError(400, "Passwords do not match");


    const existingUser = await User.findOne({ email });
    if (existingUser) throw new ApiError(409, "User already exists");

    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) throw new ApiError(400, "OTP expired or not found");
    const storedOTP = otpDoc.otp;

    if (storedOTP.trim() !== otp.trim())
        throw new ApiError(400, "Invalid OTP");


    const user = await User.create({
        name,
        email,
        password
    });

    await Otp.deleteOne({ email });

    const userData = await User.findById(user._id).select("-password");


    res
      .status(201)
      .json(
        new ApiResponse(
            201,
            userData,
            "User registered successfully"
        )
      );
});



const loginUser = asyncHandler(async (req, res) => {

    const  { email, password } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(401, "Invalid email");
    }

    if(user.isBlocked === true || user.isFraud === true){
        throw new ApiError(401, "You are blocked due to security reasons");
    }


    // Verify password using schema method
    const isMatch = await user.isPasswordCorrect(String(password).trim());

    if (!isMatch) {
        throw new ApiError(401, "Invalid password");
    }

    // generate tokens
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)


    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")



    // cookies ko modifie hone se rokta hai(except server)
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            //data k form me access or refresh token isiliye send kr rhe hai q ki mobile app me cookie nhi save hota hai(check chat gpt)
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User Logged In Sucessfully"
        )
    )
});



const refreshAccessToken = asyncHandler(async(req,res)=>{

    try{

        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if(!incomingRefreshToken){
            throw new ApiError(401,"unauthorized request")
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
            
        )

        const user = await User.findById(decodedToken?._id)

        if(!user){
            throw new ApiError(401,"Invalid Refresh token")
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const {refreshToken,accessToken} = await generateAccessAndRefreshToken(user._id)

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                accessToken,
                refreshToken
                },

                "Access token refreshed"
            )
        )


    }
    catch(error){
        throw new ApiError(401,error?.message || "Invalid refresh Token")
    }

    

})



const logoutUser = asyncHandler(async (req, res) => {

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: "" }  // ← removes the field entirely
    },
    { new: true }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))
})



const loadProfile = asyncHandler(async(req,res) => {

    // 1. get user detail
    const user = await User.findById(req.user._id)
        .select("-password -refreshToken")

    // 2. get all orders of that user (latest first)
    const orders = await Order.find({ user: req.user._id })
        .sort({ createdAt: -1 })

    // 3. combine and send together
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user,     // user details
                orders    // all orders of that user
            },
            "Profile fetched successfully"
        )
    )
}
)



// load-item
const loadItem = asyncHandler(async(req, res) => {
    const items = await Item.find();  // ✅ added await

    if(!items || items.length === 0) {
        console.log("chud gye guru");
        throw new ApiError(404, "No items found")  // ✅ throw, not return
    }

    return res
           .status(200)  // ✅ res.status(), not res()
           .json(
                new ApiResponse(200, items, "Items fetched successfully")  // ✅ new keyword
           )
})





const addAddress = asyncHandler(async (req, res) => {

    const { address } = req.body;
    const userId = req.user._id;

    if (!address || typeof address !== "object") {
        return res.status(400).json({
            success: false,
            message: "Structured address object is required"
        });
    }

    const requiredFields = ["name", "phone", "line1", "city", "pin", "state"];
    const missing = requiredFields.filter(f => !address[f]?.trim());
    if (missing.length) {
        return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missing.join(", ")}`
        });
    }

    const user = await User.findByIdAndUpdate(
        userId,
        {
            address: {
                name:  address.name.trim(),
                phone: address.phone.trim(),
                line1: address.line1.trim(),
                line2: (address.line2 || "").trim(),
                city:  address.city.trim(),
                pin:   address.pin.trim(),
                state: address.state.trim(),
            }
        },
        { new: true, runValidators: false }
    );

    return res.status(200).json({
        success: true,
        message: "Address updated successfully",
        data: { address: user.address }
    });
});




const deleteAddress = asyncHandler(async (req, res) => {


    const userId = req.user._id;


    const user = await User.findByIdAndUpdate(
        userId,
        { address: { name: "", phone: "", line1: "", line2: "", city: "", pin: "", state: "" } },
        { new: true, runValidators: false }
    );




    return res.status(200).json({
        success: true,
        message: "Address deleted"
    });
});



//cart-controller
 
function recalc(items = [], discountPct = 0) {
  const rawTotal    = items.reduce((s, it) => s + it.priceAtAdd * it.qty, 0);
  const discountAmt = Math.round(rawTotal * discountPct / 100);
  return { rawTotal, discountAmt, finalTotal: rawTotal - discountAmt };
}



 
const loadCart = asyncHandler(async (req, res) => {

  const cart = await Cart
    .findOne({ userId: req.user._id, status: "active" })
    .populate("items.itemId", "name imageUrl price category badge")
    .lean();
 
  return res
    .status(200)
    .json(new ApiResponse(200, cart ?? { items: [], coupon: {}, pricing: {} }, "Cart fetched"));
});




 
const updateQty = asyncHandler(async (req, res) => {

  const { itemId, qty } = req.body;
 
  if (!itemId)                          throw new ApiError(400, "itemId required");

  if (!Number.isInteger(qty) || qty < 1) throw new ApiError(400, "qty must be integer >= 1");
 
  const cart = await Cart.findOne({ userId: req.user._id, status: "active" });

  if (!cart) throw new ApiError(404, "Cart not found");
 
  const item = cart.items.find(it => it.itemId.toString() === itemId);

  if (!item) throw new ApiError(404, "Item not in cart");
 
  await Cart.updateOne(
    { userId: req.user._id, status: "active", "items.itemId": itemId },
    { $set: { "items.$.qty": qty, "items.$.subtotal": item.priceAtAdd * qty } }
  );
 
  const updated     = await Cart.findOne({ userId: req.user._id, status: "active" });

  const discountPct = updated.coupon?.discountPct ?? 0;

  updated.pricing   = recalc(updated.items, discountPct);

  if (updated.coupon?.code) updated.coupon.discountAmt = updated.pricing.discountAmt;

  await updated.save();
 
  return res.status(200).json(new ApiResponse(200, updated, "Quantity updated"));
});




 
const removeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
 


  const cart = await Cart.findOneAndUpdate(
    { userId: req.user._id, status: "active" },
    { $pull: { items: { itemId: itemId } } },
    { new: true }
  );


  if (!cart) throw new ApiError(404, "Cart not found");
 
  const discountPct = cart.coupon?.discountPct ?? 0;


  cart.pricing = recalc(cart.items, discountPct);


  if (cart.coupon?.code) cart.coupon.discountAmt = cart.pricing.discountAmt;
  await cart.save();

 
  return res.status(200).json(new ApiResponse(200, cart, "Item removed"));
});




 
const applyCoupon = asyncHandler(async (req, res) => {

  const code = req.body.code?.trim().toUpperCase();
  if (!code) throw new ApiError(400, "Coupon code is required");

  // Validate coupon from database
  const coupon = await Coupon.findOne({ code, isActive: true });
  if (!coupon) throw new ApiError(400, "Invalid coupon code");

  // Check expiry
  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    throw new ApiError(400, "This coupon has expired");
  }

  // Check usage limit
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError(400, "This coupon has reached its usage limit");
  }

  const pct = coupon.discountPct;

  const cart = await Cart.findOne({ userId: req.user._id, status: "active" });
  if (!cart) throw new ApiError(404, "Cart not found");
 

  const pricing  = recalc(cart.items, pct);

  cart.coupon    = { code, discountPct: pct, discountAmt: pricing.discountAmt };
  cart.pricing   = pricing;


  await cart.save();

  // Increment usage count
  await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
 
  return res.status(200).json(new ApiResponse(200, cart, "Coupon applied"));
});




 
const removeCoupon = asyncHandler(async (req, res) => {

  const cart = await Cart.findOne({ userId: req.user._id, status: "active" });

  if (!cart) throw new ApiError(404, "Cart not found");
 
  cart.coupon  = { code: null, discountPct: 0, discountAmt: 0 };
  cart.pricing = recalc(cart.items, 0);

  await cart.save();
 
  return res.status(200).json(new ApiResponse(200, cart, "Coupon removed"));
});





const AddToCart = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const userId = req.user._id;

    if (!productId) {
        throw new ApiError(400, "ProductId is required");
    }

    const item = await Item.findById(productId);

    if (!item) {
        throw new ApiError(404, "Item not found");
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
        cart = await Cart.create({
            userId,
            items: [{
                itemId:     productId,
                nameAtAdd:  item.name,    // ✅ added
                priceAtAdd: item.price,
                qty:        1,
            }],
            pricing: {
                rawTotal:   item.price,
                finalTotal: item.price
            }
        });
    } else {
        const existingItem = cart.items.find(
            i => i.itemId.toString() === productId.toString()
        );

        if (existingItem) {
            existingItem.qty += 1;
        } else {
            cart.items.push({
                itemId:     productId,
                nameAtAdd:  item.name,    // ✅ added
                priceAtAdd: item.price,
                qty:        1,
            });
        }
    }

    // Recalculate pricing
    cart.pricing.rawTotal   = cart.items.reduce(
        (acc, i) => acc + (i.priceAtAdd * i.qty), 0   // ✅ no subtotal needed
    );
    cart.pricing.finalTotal = cart.pricing.rawTotal - (cart.pricing.discountAmt || 0);

    await cart.save();

    return res.status(200).json(
        new ApiResponse(200, cart, "Cart updated successfully")
    );
});




const updatePassword = asyncHandler(async (req, res) => {

    // 1. get data
    const { otp, password } = req.body;

    // 2. validate input
    if (!otp || !password) {
        return res.status(400).json({
            success: false,
            message: "OTP and password are required"
        });
    }

    const email = req.user.email;
    const userId = req.user._id;


    if (!email) throw new ApiError(400, "Auth ka error hai");


    // 3. get OTP from redis
    const otpDoc = await Otp.findOne({ email });
    const storedOtp = otpDoc?.otp;

    if (!storedOtp) {
        return res.status(400).json({
            success: false,
            message: "OTP expired or not found"
        });
    }

    if (storedOtp !== otp) {
        return res.status(400).json({
            success: false,
            message: "Invalid OTP"
        });
    }

    // 4. update password
    const user = await User.findById(userId);

    user.password = password;

    // 🔥 IMPORTANT
    await user.save(); // this will trigger bcrypt pre-save hook

    // 5. delete OTP after success
    await Otp.deleteOne({ email });

    return res.status(200).json({
        success: true,
        message: "Password updated successfully"
    });

});



const successOrder = asyncHandler(async (req, res) => {

  const { orderId } = req.params;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }

  const order = await Order.findById(orderId)
    .populate("user", "name email");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return res.status(200).json(
    new ApiResponse(200, order, "Order fetched successfully")
  );
});





export {
    sendOTP,
    AuthsendOTP,
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    loadProfile,
    loadItem,
    addAddress,
    deleteAddress,
    updatePassword,
    loadCart,
    updateQty,
    removeItem, 
    applyCoupon, 
    removeCoupon,
    AddToCart,
    successOrder
    }
