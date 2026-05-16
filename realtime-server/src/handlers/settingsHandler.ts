import { Server } from "socket.io";
import prisma from "../utils/prisma";
import { AuthenticatedSocket } from "../middlewares/auth";

export const registerSettingsHandler = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // 1. Update Chat Settings (Theme, etc.)
  socket.on("settings:update", async (data: { 
    conversationId: string; 
    key: string; 
    value: any; 
  }) => {
    try {
      const { conversationId, key, value } = data;

      // Persist to DB
      const updateData: any = { [key]: value };
      
      await prisma.chat_settings.upsert({
        where: {
          user_id_conversation_id: {
            user_id: userId,
            conversation_id: conversationId
          }
        },
        update: updateData,
        create: {
          user_id: userId,
          conversation_id: conversationId,
          ...updateData
        }
      });

      // Broadcast to other participants to sync UI
      socket.to(`conversation:${conversationId}`).emit("settings:sync", {
        conversationId,
        key,
        value
      });

      socket.emit("success", { message: "Theme updated" });
    } catch (err) {
      console.error("Settings update error:", err);
      socket.emit("error", { message: "Failed to update settings" });
    }
  });
};
