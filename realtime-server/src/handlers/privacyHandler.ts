import { Server } from "socket.io";
import prisma from "../utils/prisma";
import { AuthenticatedSocket } from "../middlewares/auth";

export const registerPrivacyHandler = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // 1. Block User
  socket.on("user:block", async (data: { targetId: number }) => {
    try {
      if (userId === data.targetId) return;

      // 1. Update Database
      await prisma.blocked_users.upsert({
        where: {
          blocker_id_blocked_id: {
            blocker_id: userId,
            blocked_id: data.targetId
          }
        },
        update: {},
        create: {
          blocker_id: userId,
          blocked_id: data.targetId
        }
      });

      // 2. Find any common direct conversations
      const conversations = await prisma.conversations.findMany({
        where: {
          type: "direct",
          AND: [
            { members: { some: { user_id: userId } } },
            { members: { some: { user_id: data.targetId } } }
          ]
        }
      });

      // 3. Broadcast to both users to close/refresh their UI
      conversations.forEach(c => {
        io.to(`conversation:${c.id}`).emit("privacy:blocked", {
          conversationId: c.id,
          blockerId: userId,
          blockedId: data.targetId
        });
      });

      socket.emit("success", { message: "User blocked successfully" });
    } catch (err) {
      console.error("Block error:", err);
      socket.emit("error", { message: "Failed to block user" });
    }
  });

  // 2. Unblock User
  socket.on("user:unblock", async (data: { targetId: number }) => {
    try {
      await prisma.blocked_users.deleteMany({
        where: {
          blocker_id: userId,
          blocked_id: data.targetId
        }
      });

      socket.emit("success", { message: "User unblocked successfully" });
    } catch (err) {
      console.error("Unblock error:", err);
      socket.emit("error", { message: "Failed to unblock user" });
    }
  });

  // 3. Report User/Message
  socket.on("content:report", async (data: { 
    targetType: "user" | "message"; 
    targetId: number; 
    reason: string;
    description?: string;
  }) => {
    try {
      await prisma.reports.create({
        data: {
          reporter_id: userId,
          target_type: data.targetType,
          target_id: data.targetId,
          reason: data.reason,
          description: data.description,
          status: "pending"
        }
      });

      socket.emit("success", { message: "Report submitted to Neurality Oversight." });
    } catch (err) {
      console.error("Report error:", err);
      socket.emit("error", { message: "Failed to submit report" });
    }
  });
};
