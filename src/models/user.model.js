import mongoose from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 3,
      maxlength: 50
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"]
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },

    refreshToken: {
      type: String
    },
    
    address: {
      name:  { type: String, default: "" },
      phone: { type: String, default: "" },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city:  { type: String, default: "" },
      pin:   { type: String, default: "" },
      state: { type: String, default: "" },
    },

    profilePhoto: {
      type: String, // Cloudinary URL
    },

    isBlocked: {
    type: Boolean,
    default: false
    },

    isFraud: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: true
  }
)


userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  this.password = await bcrypt.hash(this.password, 10);
  next();
});




//Custom method
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password,this.password)
}



userSchema.methods.generateAccessToken =  function(){
    return jwt.sign(
        {
            _id: this._id,
            name: this.name,
            email: this.email,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
           expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}



userSchema.methods.generateRefreshToken =  function(){
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
           expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )   
}


const User = mongoose.model("User", userSchema)

export { User }