import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redis = createClient({
  url: redisUrl,
});

redis.on("error", (err) => console.error("Redis Client Error", err));

const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
    console.log("Connected to Redis");
  }
};

export { redis, connectRedis };
