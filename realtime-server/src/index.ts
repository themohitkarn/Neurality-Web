import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import cors from "cors";
import cron from "node-cron";
import axios from "axios";
import multer from "multer";
import path from "path";
import fs from "fs";
import { socketAuthMiddleware, AuthenticatedSocket } from "./middlewares/auth";
import prisma from "./utils/prisma";
import redis from "./utils/redis";
import { messageQueue } from "./queues/messageQueue";

import { registerMessageHandler } from "./handlers/messageHandler";
import { registerPresenceHandler } from "./handlers/presenceHandler";
import { registerCallHandler } from "./handlers/callHandler";
import { registerGroupHandler } from "./handlers/groupHandler";
import { registerPrivacyHandler } from "./handlers/privacyHandler";
import { registerSettingsHandler } from "./handlers/settingsHandler";

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5001;

const CORS_ORIGIN = process.env.CORS_ORIGIN;
if (!CORS_ORIGIN) {
  throw new Error("CORS_ORIGIN is missing in environment variables");
}
const allowedOrigins = CORS_ORIGIN.split(',').map(o => o.trim());

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
}

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "realtime"
  });
});

app.get("/metrics", async (req, res) => {
  try {
    const sockets = await io.fetchSockets();
    res.status(200).json({
      connections: sockets.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

app.use(express.json());

// --- FILE UPLOAD SETUP ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../backend/static/uploads/groups");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `group_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Redis setup for Socket.IO Adapter (Horizontal Scaling)
const pubClient = redis;
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Auth Middleware
io.use(socketAuthMiddleware);

// --- INTERNAL PUB/SUB FOR WORKERS ---
subClient.subscribe("realtime:internal", (err) => {
  if (err) console.error("Internal Sub Error:", err);
});

subClient.on("message", (channel, message) => {
  if (channel === "realtime:internal") {
    try {
      const data = JSON.parse(message);
      console.log(`[Redis] ACK: Internal message received for room ${data.room}`);
      io.to(data.room).emit(data.event, data.payload);
    } catch (e) {
      console.error("[Redis] Failed to parse internal message", e);
    }
  }
});

io.on("connection", async (socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;
  if (!userId) return socket.disconnect();

  // Register Modular Handlers
  registerPresenceHandler(io, socket);
  registerMessageHandler(io, socket);
  registerCallHandler(io, socket);
  registerGroupHandler(io, socket);
  registerPrivacyHandler(io, socket);
  registerSettingsHandler(io, socket);

  console.log(`[Neurality] User ${userId} connected (Socket: ${socket.id})`);
});

// --- REST API FOR HISTORY ---
import jwt from "jsonwebtoken";

const restAuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { user_id: number };
    (req as any).userId = decoded.user_id;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

app.get("/api/conversations", restAuthMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const startTime = Date.now();
  
  try {
    console.log(`[REST] GET /api/conversations - User: ${userId}`);

    const dbQuery = prisma.conversations.findMany({
      where: { members: { some: { user_id: userId } } },
      include: { 
        members: { include: { user: { select: { id: true, username: true, profile_pic: true } } } }, 
        messages: { orderBy: { created_at: 'desc' }, take: 1 } 
      },
      orderBy: { updated_at: 'desc' }
    });

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Database timeout")), 10000));
    
    // 10s Timeout protection
    const rawConvs = (await Promise.race([dbQuery, timeout])) as any[];
    
    console.log(`[REST] DB Query took ${Date.now() - startTime}ms. Fetched ${rawConvs.length} convs.`);

    // Defensive Serialization
    const serializedConvs = rawConvs.map(conv => {
      return {
        id: conv.id || "",
        type: conv.type || "direct",
        name: conv.name || null,
        description: conv.description || null,
        avatar: conv.avatar || null,
        created_at: conv.created_at ? new Date(conv.created_at).toISOString() : null,
        updated_at: conv.updated_at ? new Date(conv.updated_at).toISOString() : null,
        members: (conv.members || []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role || "member",
          user: m.user ? {
            id: m.user.id,
            username: m.user.username || "Unknown",
            profile_pic: m.user.profile_pic || null
          } : null
        })).filter((m: any) => m.user_id),
        messages: (conv.messages || []).map((msg: any) => ({
          id: msg.id,
          content: msg.content || "",
          type: msg.type || "text",
          sender_id: msg.sender_id,
          created_at: msg.created_at ? new Date(msg.created_at).toISOString() : null
        }))
      };
    });

    const payloadStr = JSON.stringify(serializedConvs);
    const payloadSize = Buffer.byteLength(payloadStr, 'utf8');
    console.log(`[REST] Serialization successful. Payload size: ${(payloadSize / 1024).toFixed(2)} KB`);

    res.status(200).json({ success: true, conversations: serializedConvs });
  } catch (error: any) {
    console.error(`[REST] GET /api/conversations ERROR:`, error.message || "Unknown error");
    res.status(500).json({ success: false, message: "Failed to load conversations" });
  }
});

app.post("/api/groups/create", restAuthMiddleware, upload.single("group_pic"), async (req, res) => {
  const userId = (req as any).userId;
  const { name, description, members } = req.body;
  
  // Parse members if sent as string (from FormData)
  let userIds: number[] = [];
  if (Array.isArray(members)) {
    userIds = members.map(id => parseInt(id as any));
  } else if (typeof members === 'string') {
    userIds = members.split(',').map(id => parseInt(id.trim()));
  }

  try {
    const conversation = await prisma.conversations.create({
      data: {
        type: "group",
        name: name,
        description: description,
        avatar: req.file ? `/static/uploads/groups/${req.file.filename}` : null,
        members: {
          create: [
            { user_id: userId, role: "admin" },
            ...userIds.filter(id => id !== userId).map(id => ({ user_id: id, role: "member" }))
          ]
        }
      },
      include: { 
        members: { include: { user: { select: { id: true, username: true, profile_pic: true } } } } 
      }
    });
    res.json({ success: true, group: conversation });
  } catch (err: any) {
    console.error("Group creation error:", err.message);
    res.status(500).json({ message: "Failed to create group" });
  }
});

app.get("/api/chat/dm/:targetUserId", restAuthMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const targetUserId = parseInt(req.params.targetUserId as string);
  
  if (isNaN(targetUserId)) return res.status(400).json({ message: "Invalid user ID" });

  try {
    let conversation = await prisma.conversations.findFirst({
      where: {
        type: "direct",
        AND: [
          { members: { some: { user_id: userId } } },
          { members: { some: { user_id: targetUserId } } }
        ]
      },
      include: {
        chat_settings: { where: { user_id: userId } },
        messages: {
          where: { 
            is_deleted: false,
            deletions: { none: { user_id: userId } }
          },
          include: { 
            sender: { select: { id: true, username: true, profile_pic: true } },
            reactions: { include: { user: { select: { id: true, username: true } } } },
            reads: true,
            reply_to: { select: { id: true, content: true, sender_id: true, type: true, is_deleted: true } },
            edits: { orderBy: { edited_at: 'desc' }, take: 1 }
          },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!conversation) {
      conversation = await prisma.conversations.create({
        data: {
          type: "direct",
          members: {
            create: [
              { user_id: userId },
              { user_id: targetUserId }
            ]
          }
        },
        include: {
          chat_settings: { where: { user_id: userId } },
          messages: {
            where: { is_deleted: false },
            include: { 
              sender: { select: { id: true, username: true, profile_pic: true } },
              reactions: { include: { user: { select: { id: true, username: true } } } },
              reads: true,
              edits: { orderBy: { edited_at: 'desc' }, take: 1 },
              reply_to: { select: { id: true, content: true, sender_id: true, type: true, is_deleted: true } }
            },
            orderBy: { created_at: 'asc' }
          }
        }
      });
    }

    // Tag messages with is_mine for the requesting user
    const messages = (conversation!.messages || []).map((m: any) => ({
      ...m,
      is_mine: m.sender_id === userId,
      is_read: m.reads?.some((r: any) => r.user_id !== m.sender_id) || false
    }));

    res.json({ 
      conversation: { 
        id: conversation!.id, 
        type: conversation!.type,
        settings: (conversation as any).chat_settings?.[0] || {}
      }, 
      messages 
    });
  } catch (err) {
    console.error("DM fetch error:", err);
    res.status(500).json({ messages: [] });
  }
});

app.get("/api/messages/:conversationId", restAuthMiddleware, async (req, res) => {
  const conversationId = req.params.conversationId as string;
  const userId = (req as any).userId;

  try {
    // 1. Authorize membership
    const member = await prisma.conversation_members.findFirst({
      where: { conversation_id: conversationId, user_id: userId }
    });
    if (!member) {
      return res.status(403).json({ message: "Unauthorized: You are not a member of this conversation." });
    }

    const messages = await prisma.messages.findMany({
      where: { 
        conversation_id: conversationId, 
        is_deleted: false,
        deletions: { none: { user_id: userId } }
      },
      include: { 
        reactions: { include: { user: { select: { id: true, username: true } } } }, 
        reply_to: { select: { id: true, content: true, sender_id: true, type: true, is_deleted: true } },
        sender: { select: { id: true, username: true, profile_pic: true } }
      },
      orderBy: { created_at: 'asc' }
    });
    res.json({ messages });
  } catch (err) {
    console.error("Messages fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/conversations/:conversationId/media", restAuthMiddleware, async (req, res) => {
  const conversationId = req.params.conversationId as string;
  const userId = (req as any).userId;

  try {
    // 1. Authorize membership
    const member = await prisma.conversation_members.findFirst({
      where: { conversation_id: conversationId, user_id: userId }
    });
    if (!member) {
      return res.status(403).json({ message: "Unauthorized: You are not a member of this conversation." });
    }

    const mediaMessages = await prisma.messages.findMany({
      where: {
        conversation_id: conversationId,
        is_deleted: false,
        type: { in: ["image", "video", "shared_post", "shared_reel"] },
        deletions: { none: { user_id: userId } }
      },
      select: {
        id: true,
        content: true,
        type: true,
        created_at: true,
        sender_id: true
      },
      orderBy: { created_at: 'desc' }
    });

    // Transform shared content if needed (parsing JSON for shared items)
    const media = mediaMessages.map(m => {
      if (m.type.startsWith("shared_")) {
        try {
          const data = JSON.parse(m.content || "");
          return { ...m, url: data.thumbnail || data.video_path || data.image_path };
        } catch (e) { return { ...m, url: m.content }; }
      }
      return { ...m, url: m.content };
    });

    res.json({ media });
  } catch (err) {
    console.error("Media fetch error:", err);
    res.status(500).json({ media: [] });
  }
});


// Helper: Get or Create DM conversation (handled by first handler above)

// Share content API
app.post("/api/chat/share", restAuthMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const { userIds, postId, reelId, text } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: "No users selected" });
  }

  try {
    let contentData: any = {};
    let mType = "shared_post";

    if (postId) {
      const post = await prisma.posts.findUnique({
        where: { id: parseInt(postId) },
        include: { user: { select: { username: true, profile_pic: true } } }
      });
      if (post) {
        contentData = {
          id: post.id,
          type: "post",
          title: post.caption || "Post",
          thumbnail: post.image_path,
          route: `/profile/${post.user_id}`,
          creator: { username: post.user.username, profile_pic: post.user.profile_pic }
        };
      }
    } else if (reelId) {
      const reel = await prisma.reels.findUnique({
        where: { id: parseInt(reelId) },
        include: { user: { select: { username: true, profile_pic: true } } }
      });
      if (reel) {
        mType = "shared_reel";
        contentData = {
          id: reel.id,
          type: "reel",
          title: reel.caption || "Reel",
          thumbnail: reel.thumbnail_path || reel.video_path,
          route: `/beat?id=${reel.id}`,
          creator: { username: reel.user.username, profile_pic: reel.user.profile_pic }
        };
      }
    }

    const contentJson = JSON.stringify(contentData);

    for (const targetId of userIds) {
      if (targetId === userId) continue;

      // Get/Create conversation
      let conv = await prisma.conversations.findFirst({
        where: {
          type: "direct",
          AND: [
            { members: { some: { user_id: userId } } },
            { members: { some: { user_id: targetId } } }
          ]
        }
      });

      if (!conv) {
        conv = await prisma.conversations.create({
          data: {
            type: "direct",
            members: { create: [{ user_id: userId }, { user_id: targetId }] }
          }
        });
      }

      // Create message
      const message = await prisma.messages.create({
        data: {
          conversation_id: conv.id,
          sender_id: userId,
          content: contentJson,
          type: mType
        },
        include: { sender: { select: { id: true, username: true, profile_pic: true } } }
      });

      // Emit realtime
      io.to(`conversation:${conv.id}`).emit("message:received", { ...message, is_mine: false });
      
      // If the sender is also in a room for this conversation (they usually are if they just sent it)
      // but message:received is for others. The sender gets message:sent.
      // Wait, since this is a loop for multiple receivers, we don't emit message:sent here,
      // instead we just finish and the frontend can assume success or we return the count.
    }

    res.json({ message: `Successfully shared with ${userIds.length} users` });
  } catch (err) {
    console.error("Share error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CRON JOBS ──
cron.schedule("* * * * *", async () => {
  try {
    const expired = await prisma.messages.deleteMany({
      where: {
        expires_at: { lt: new Date() },
        is_vanish: true
      }
    });
    if (expired.count > 0) {
      console.log(`[Vanish] Purged ${expired.count} expired signals.`);
    }
  } catch (err) {
    console.error("Vanish cron error:", err);
  }
});

httpServer.listen(PORT, () => {
  console.log(`[Neurality Realtime] Engine active on port ${PORT}`);
});
