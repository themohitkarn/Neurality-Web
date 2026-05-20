import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/auth";
import prisma from "../utils/prisma";

export const registerGroupHandler = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // 1. Join Group
  socket.on("group:join", async (data: { conversationId: string }) => {
    try {
      // Validate group conversation type to prevent unauthorized joining/escalation
      const conversation = await prisma.conversations.findUnique({
        where: { id: data.conversationId }
      });
      if (!conversation || conversation.type !== "group") {
        socket.emit("error", { message: "Invalid group conversation." });
        return;
      }

      const member = await prisma.conversation_members.upsert({
        where: {
          conversation_id_user_id: {
            conversation_id: data.conversationId,
            user_id: userId
          }
        },
        update: { role: "member" },
        create: {
          conversation_id: data.conversationId,
          user_id: userId,
          role: "member"
        }
      });
      
      socket.join(`conversation:${data.conversationId}`);
      io.to(`conversation:${data.conversationId}`).emit("group:member_joined", { 
        userId, 
        member 
      });
    } catch (err) {
      console.error("Group join error:", err);
    }
  });

  // 2. Leave Group
  socket.on("group:leave", async (data: { conversationId: string }) => {
    try {
      await prisma.conversation_members.deleteMany({
        where: { conversation_id: data.conversationId, user_id: userId }
      });
      
      socket.leave(`conversation:${data.conversationId}`);
      io.to(`conversation:${data.conversationId}`).emit("group:member_left", { 
        userId 
      });
    } catch (err) {
      console.error("Group leave error:", err);
    }
  });

  // 3. Update Group Info (Admin only check)
  socket.on("group:update", async (data: { conversationId: string; name?: string; description?: string }) => {
    try {
      // 1. Verify group conversation type
      const conversation = await prisma.conversations.findUnique({
        where: { id: data.conversationId }
      });
      if (!conversation || conversation.type !== "group") {
        socket.emit("error", { message: "Invalid group conversation." });
        return;
      }

      // 2. Check if user is an admin of the group
      const member = await prisma.conversation_members.findFirst({
        where: {
          conversation_id: data.conversationId,
          user_id: userId
        }
      });
      
      if (!member || member.role !== "admin") {
        socket.emit("error", { message: "Unauthorized: Only group admins can update group details." });
        return;
      }

      const updated = await prisma.conversations.update({
        where: { id: data.conversationId },
        data: { name: data.name, description: data.description }
      });
      
      io.to(`conversation:${data.conversationId}`).emit("group:updated", updated);
    } catch (err) {
      console.error("Group update error:", err);
      socket.emit("error", { message: "Failed to update group information." });
    }
  });
};
