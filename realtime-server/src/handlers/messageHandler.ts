import { Server, Socket } from "socket.io";
import prisma from "../utils/prisma";
import { messageQueue } from "../queues/messageQueue";
import { AuthenticatedSocket } from "../middlewares/auth";
import { Redis } from "ioredis";
import axios from "axios";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);

export const registerMessageHandler = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  // 1. Join Conversation Room
  socket.on("conversation:join", (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  // 2. Send Message
  socket.on("message:send", async (data: { 
    content: string; 
    conversationId?: string;
    receiverId?: number;
    groupId?: number;
    type?: string;
    replyToId?: string;
    isVanish?: boolean;
    expiresIn?: number;
  }) => {
    try {
      let convId = data.conversationId;

      // Handle direct message or group message without conversationId
      if (!convId) {
        if (data.receiverId) {
          const isSelf = userId === data.receiverId;
          const existing = await prisma.conversations.findFirst({
            where: {
              type: "direct",
              AND: isSelf 
                ? [ { members: { some: { user_id: userId } } }, { members: { none: { user_id: { not: userId } } } } ]
                : [ { members: { some: { user_id: userId } } }, { members: { some: { user_id: data.receiverId } } } ]
            }
          });
          
          if (existing) {
            convId = existing.id;
          } else {
            const created = await prisma.conversations.create({
              data: {
                type: "direct",
                members: {
                  create: isSelf ? [{ user_id: userId }] : [{ user_id: userId }, { user_id: data.receiverId }]
                }
              }
            });
            convId = created.id;
          }
        } else if (data.groupId) {
          const groupConv = await prisma.conversations.findFirst({
            where: {
              id: data.groupId?.toString(),
              type: "group"
            }
          });
          if (groupConv) convId = groupConv.id;
        }
      }

      if (!convId) throw new Error("No conversation found");

      // ── Block & Disappearing Logic ──
      const conversation = await prisma.conversations.findUnique({
        where: { id: convId },
        include: { 
          members: true,
          chat_settings: { where: { user_id: userId } }
        }
      });

      const activeSettings = conversation?.chat_settings[0];
      const ttl = activeSettings?.disappearing_timer || 0;

      if (conversation?.type === "direct") {
        const otherMember = conversation.members.find(m => m.user_id !== userId);
        if (otherMember) {
          const isBlocked = await prisma.blocked_users.findFirst({
            where: {
              OR: [
                { blocker_id: userId, blocked_id: otherMember.user_id },
                { blocker_id: otherMember.user_id, blocked_id: userId }
              ]
            }
          });
          if (isBlocked) {
            return socket.emit("error", { 
              message: "Action restricted by privacy settings.",
              code: "USER_BLOCKED" 
            });
          }
        }
      }

      const message = await prisma.messages.create({
        data: {
          conversation_id: convId,
          sender_id: userId,
          content: data.content,
          type: data.type || "text",
          reply_to_id: data.replyToId,
          is_vanish: ttl > 0,
          expires_at: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null
        },
        include: {
          sender: { select: { id: true, username: true, profile_pic: true } },
          reply_to: { select: { id: true, content: true, sender_id: true, type: true, is_deleted: true } }
        }
      });

      io.to(`conversation:${convId}`).emit("message:received", {
        ...message,
        is_mine: false
      });

      socket.emit("message:sent", { ...message, is_mine: true });

      // Update conversation updated_at
      await prisma.conversations.update({
        where: { id: convId },
        data: { updated_at: new Date() }
      });

      // Offload AI Processing
      if (data.type === "text" || !data.type) {
        await messageQueue.add("AI_PROCESS", { 
          type: "AI_PROCESS", 
          data: { messageId: message.id, content: data.content } 
        });
      }

      // ── Push Notification logic ──
      if (data.receiverId) {
        const isOnline = await redis.get(`presence:${data.receiverId}`);
        if (!isOnline || isOnline === "offline") {
          const flaskUrl = process.env.FLASK_API_URL || "http://localhost:5000/api";
          axios.post(`${flaskUrl}/notifications/internal/send-push`, {
            user_id: data.receiverId,
            title: `New message from ${message.sender.username}`,
            body: data.content,
            type: "new_message"
          }).catch(e => console.error("Push notify error:", e.message));
        }
      }
    } catch (error) {
      console.error("Send error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // 3. Edit Message
  socket.on("message:edit", async (data: { messageId: string; newContent: string }) => {
    try {
      const msg = await prisma.messages.findUnique({ where: { id: data.messageId } });
      if (!msg || msg.sender_id !== userId) return;

      await prisma.$transaction([
        prisma.message_edits.create({
          data: { message_id: data.messageId, old_content: msg.content || "", new_content: data.newContent }
        }),
        prisma.messages.update({
          where: { id: data.messageId },
          data: { content: data.newContent, is_edited: true }
        })
      ]);

      io.to(`conversation:${msg.conversation_id}`).emit("message:updated", { 
        messageId: data.messageId, 
        content: data.newContent 
      });
    } catch (err) { 
      console.error("Edit error:", err);
    }
  });

  // 4. Delete Message (Unsend for everyone)
  socket.on("message:delete", async (data: { messageId: string }) => {
    try {
      const msg = await prisma.messages.findUnique({ where: { id: data.messageId } });
      if (!msg || msg.sender_id !== userId) return;

      await prisma.messages.update({ where: { id: data.messageId }, data: { is_deleted: true } });
      io.to(`conversation:${msg.conversation_id}`).emit("message:deleted", { messageId: data.messageId });
    } catch (err) { 
      console.error("Delete error:", err);
    }
  });

  // 4b. Delete for me ONLY
  socket.on("message:delete_for_me", async (data: { messageId: string }) => {
    try {
      await prisma.message_deletions.create({
        data: { message_id: data.messageId, user_id: userId }
      });
      socket.emit("message:deleted_for_me", { messageId: data.messageId });
    } catch (err) {
      console.error("Delete for me error:", err);
    }
  });

  // 5. Typing Indicators (Redis Backed)
  socket.on("message:typing", async (data: { conversationId: string; isTyping: boolean }) => {
    const typingKey = `typing:${data.conversationId}:${userId}`;
    if (data.isTyping) {
      await redis.set(typingKey, "1", "EX", 10); // 10s auto-expire
    } else {
      await redis.del(typingKey);
    }

    socket.to(`conversation:${data.conversationId}`).emit("message:typing", { 
      userId, 
      conversationId: data.conversationId,
      isTyping: data.isTyping 
    });
  });

  // 6. Seen Receipts (With Mutual Privacy)
  socket.on("message:seen", async (data: { messageIds: string[]; conversationId: string }) => {
    try {
      // Check if current user has receipts enabled (Merged from user_settings into users)
      const user = await prisma.users.findUnique({ 
        where: { id: userId },
        select: { read_receipts_enabled: true }
      });
      if (user && !user.read_receipts_enabled) return;

      await prisma.message_reads.createMany({
        data: data.messageIds.map(mid => ({ message_id: mid, user_id: userId })),
        skipDuplicates: true
      });

      // Notify others in conversation
      // In a real app, we might check each member's settings, 
      // but for "Mutual Privacy", we filter on the frontend or just broadcast 
      // and let the frontend hide it if the recipient has it disabled.
      // However, we'll do a server-side broadcast here.
      socket.to(`conversation:${data.conversationId}`).emit("message:seen_update", {
        messageIds: data.messageIds,
        seenBy: userId,
        at: new Date()
      });
    } catch (err) { 
      console.error("Seen error:", err);
    }
  });

  // 7. Toggle Reactions
  socket.on("reaction:toggle", async (data: { messageId: string; emoji: string }) => {
    try {
      const existing = await prisma.message_reactions.findFirst({
        where: { message_id: data.messageId, user_id: userId, emoji: data.emoji }
      });

      if (existing) {
        await prisma.message_reactions.delete({ where: { id: existing.id } });
      } else {
        await prisma.message_reactions.create({
          data: { message_id: data.messageId, user_id: userId, emoji: data.emoji }
        });
      }

      const all = await prisma.message_reactions.findMany({ 
        where: { message_id: data.messageId },
        include: { user: { select: { id: true, username: true } } }
      });
      
      const msg = await prisma.messages.findUnique({ where: { id: data.messageId } });
      if (msg) {
        io.to(`conversation:${msg.conversation_id}`).emit("reaction:update", {
          messageId: data.messageId,
          reactions: all
        });
      }
    } catch (err) { 
      console.error("Reaction error:", err);
    }
  });

  // 8. Schedule Message
  socket.on("message:schedule", async (data: { 
    conversationId: string; 
    content: string; 
    scheduledFor: Date;
    type?: string;
  }) => {
    try {
      const scheduled = await prisma.scheduled_messages.create({
        data: {
          conversation_id: data.conversationId,
          sender_id: userId,
          content: data.content,
          scheduled_for: new Date(data.scheduledFor),
          type: data.type || "text"
        }
      });

      const delay = new Date(data.scheduledFor).getTime() - Date.now();
      await messageQueue.add("SEND_SCHEDULED", 
        { type: "SEND_SCHEDULED", data: { id: scheduled.id } },
        { delay: Math.max(0, delay) }
      );

      socket.emit("message:scheduled", { ...scheduled, status: "pending" });
    } catch (err) { 
      console.error("Schedule error:", err);
    }
  });
};
