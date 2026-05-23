//---> mongoose ko import kar rahi hai taki tum database(Mongodb) se baat kar sako.
import mongoose from "mongoose";


//--->  db ka naam ek centralized jagah pe store karke use kar rahe ho.
import { DB_NAME } from "../constant.js"




//async ka reason: "Datebase a dusre continent me hai"

const connectDB = async ()=>{
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`)
        console.log(`\n MongoDB connected !! DB HOST ${connectionInstance.connection.host}`);
    }catch(error){
        console.log("MONGODB connection error",error);
        process.exit(1)
    }
}

export default connectDB