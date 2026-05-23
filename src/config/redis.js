import { createClient } from "redis"
import dotenv from "dotenv"

dotenv.config()

const redisClient = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
})

redisClient.on("error", (err) => {
  console.log("Redis Client Error:", err)
})

const connectRedis = async () => {
  await redisClient.connect()
  console.log("✅ Redis Connected Successfully")
}

export { redisClient,connectRedis}