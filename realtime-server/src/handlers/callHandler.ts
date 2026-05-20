import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/auth";
import redis from "../utils/redis";

export const registerCallHandler = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // 1. Initiate Call
  socket.on("call:initiate", async (data: { receiverId: number; type: string; signal: any }) => {
    try {
      const sessionId = `rtc:${userId}:${data.receiverId}`;
      // Store session state in Redis for recovery/tracking
      await redis.set(sessionId, JSON.stringify({ 
        callerId: userId, 
        receiverId: data.receiverId,
        type: data.type,
        status: "ringing",
        startedAt: new Date()
      }), "EX", 3600);
      
      io.to(`user:${data.receiverId}`).emit("call:incoming", {
        from: userId,
        type: data.type,
        signal: data.signal,
        sessionId
      });
    } catch (err) {
      console.error("Call init error:", err);
    }
  });

  // 2. Accept Call
  socket.on("call:accept", (data: { callerId: number; signal: any }) => {
    io.to(`user:${data.callerId}`).emit("call:accepted", { 
      from: userId, 
      signal: data.signal 
    });
  });

  // 3. Signaling (ICE Candidates, etc.)
  socket.on("call:signal", (data: { to: number; signal: any }) => {
    io.to(`user:${data.to}`).emit("call:signal", { 
      from: userId, 
      signal: data.signal 
    });
  });

  // 4. Reject/End Call
  socket.on("call:end", async (data: { to: number }) => {
    try {
      await redis.del(`rtc:${userId}:${data.to}`, `rtc:${data.to}:${userId}`);
      io.to(`user:${data.to}`).emit("call:ended", { from: userId });
    } catch (err) {
      console.error("Call end error:", err);
    }
  });

  // 5. Busy State
  socket.on("call:busy", (data: { to: number }) => {
    io.to(`user:${data.to}`).emit("call:busy", { from: userId });
  });
};
