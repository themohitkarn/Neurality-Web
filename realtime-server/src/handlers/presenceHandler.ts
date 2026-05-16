import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/auth";
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);

export const registerPresenceHandler = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  const updatePresence = async (status: string) => {
    try {
      await redis.set(`presence:${userId}`, status, "EX", 300); // 5 min TTL
      io.emit("presence:update", { 
        userId, 
        status, 
        lastSeen: status === "offline" ? new Date() : null 
      });
    } catch (err) {
      console.error("Presence update error:", err);
    }
  };

  // 1. Join personal room for targeted events
  socket.join(`user:${userId}`);

  // 2. Set Online
  updatePresence("online");

  // 3. Heartbeat (to keep status alive)
  socket.on("presence:heartbeat", () => {
    redis.expire(`presence:${userId}`, 300);
  });

  // 4. Handle Disconnect
  socket.on("disconnect", () => {
    updatePresence("offline");
  });

  // 5. Explicit Status Change (Away, DND)
  socket.on("presence:change", (data: { status: string }) => {
    updatePresence(data.status);
  });
};
