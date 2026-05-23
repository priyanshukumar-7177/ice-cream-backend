import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { Admin } from "../models/admin.model.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async(req, _,next) =>{
    
    try{
       
        const token = req.cookies?.accessToken || req.header
        ("Authorization")?.replace("Bearer ","")

        if(!token){
            throw new ApiError(401,"Unauthorized request")
        }

        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select
        ("-password -refreshToken")


        if(!user){
            throw new ApiError(401,"Invalid Access Token")
        }

        // add new object user
        req.user = user
        
        next()

    }
    catch(error){

        throw new ApiError(401,error?.message||
            "Invalid Access  token")
    }
    
})


const AdminVerifyJWT = asyncHandler(async(req, _,next) =>{
    
    try{
       
        const token = req.cookies?.accessToken || req.header
        ("Authorization")?.replace("Bearer ","")

        if(!token){
            throw new ApiError(401,"Unauthorized request")
        }

        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

        const admin = await Admin.findById(decodedToken?._id).select
        ("-refreshToken")

        if(!admin){
            throw new ApiError(401,"Invalid Access Token")
        }

        // add new object user
        req.admin = admin
        
        next()

    }
    catch(error){

        throw new ApiError(401,error?.message||
            "Invalid Access  token")
    }
    
})


export {verifyJWT,AdminVerifyJWT};