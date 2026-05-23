import { Router } from "express";


import {
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
    } from "../controllers/user.controllers.js";



import {verifyJWT} from "../middlewares/auth.middleware.js";


const router = Router();


router.route("/send-otp").post(sendOTP);
router.route("/auth-send-otp").post(verifyJWT,AuthsendOTP);
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/profile").get(verifyJWT,loadProfile);
router.route("/logout").post(verifyJWT,logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/load-items").get(verifyJWT,loadItem);
router.route("/add-address").post(verifyJWT,addAddress);
router.route("/delete-address").delete(verifyJWT,deleteAddress);
router.route("/update-password").post(verifyJWT,updatePassword);



//cart-route
router.route('/load-cart').get(verifyJWT,loadCart);
router.route('/qty').patch(verifyJWT,updateQty);
router.route('/item/:itemId').delete(verifyJWT,removeItem);
router.route('/coupon').post(verifyJWT,applyCoupon);
router.route('/coupon').delete(verifyJWT,removeCoupon);
router.route('/add-to-cart').post(verifyJWT,AddToCart);

router.route('/success-order/:orderId')
  .get(verifyJWT, successOrder);



export default router;
