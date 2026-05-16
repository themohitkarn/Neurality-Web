import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import prisma from "../utils/prisma";
import axios from "axios";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// 1. Message Queue (Scheduled & AI Tasks)
export const messageQueue = new Queue("message-queue", { connection });

// 2. Worker Logic
export const messageWorker = new Worker(
  "message-queue",
  async (job: Job) => {
    const { type, data } = job.data;

    switch (type) {
      case "SEND_SCHEDULED": {
        const msg = await prisma.scheduled_messages.findUnique({ where: { id: data.id } });
        if (!msg || msg.is_sent) return;

        const sent = await prisma.messages.create({
          data: {
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            content: msg.content,
            type: msg.type,
          }
        });

        await prisma.scheduled_messages.update({
          where: { id: msg.id },
          data: { is_sent: true }
        });

        // We can't easily emit from here without access to IO instance
        // But we can use Redis Pub/Sub to trigger an emit in the main server
        connection.publish("realtime:internal", JSON.stringify({
          event: "message:received",
          room: `conversation:${msg.conversation_id}`,
          payload: { ...sent, is_mine: false }
        }));
        break;
      }

      case "AI_PROCESS": {
        // AI Summarization, Mood Detection, etc.
        try {
          const flaskUrl = process.env.FLASK_API_URL || "http://localhost:5000/api";
          const res = await axios.post(`${flaskUrl}/ai/process-message`, {
            messageId: data.messageId,
            content: data.content
          });
          
          if (res.data) {
            await prisma.ai_message_metadata.upsert({
              where: { message_id: data.messageId },
              update: res.data,
              create: { message_id: data.messageId, ...res.data }
            });
          }
        } catch (err: any) {
          console.error("AI Queue Process Error:", err.message);
        }
        break;
      }
    }
  },
  { connection }
);

console.log("[BullMQ] Message Worker active and listening for jobs");
