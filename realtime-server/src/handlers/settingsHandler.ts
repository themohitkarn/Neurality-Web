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

      // Map frontend keys to DB keys
      let dbKey = key;
      if (key === "theme_id") {
        dbKey = "theme_color";
      }

      const validDbKeys = ["theme_color", "is_muted", "read_receipts_enabled", "typing_indicators_enabled"];
      
      if (validDbKeys.includes(dbKey)) {
        const updateData: any = { [dbKey]: value };
        const existing = await prisma.chat_settings.findFirst({
          where: {
            user_id: userId,
            conversation_id: conversationId
          }
        });

        if (existing) {
          await prisma.chat_settings.update({
            where: { id: existing.id },
            data: updateData
          });
        } else {
          await prisma.chat_settings.create({
            data: {
              user_id: userId,
              conversation_id: conversationId,
              ...updateData
            }
          });
        }
      } else {
        console.log(`Skipping database persistence for non-column key: ${key}`);
      }

      // Broadcast to other participants to sync UI
      socket.to(`conversation:${conversationId}`).emit("settings:sync", {
        conversationId,
        key,
        value
      });

      socket.emit("success", { message: "Settings updated" });
    } catch (err) {
      console.error("Settings update error:", err);
      socket.emit("error", { message: "Failed to update settings" });
    }
  });
};
