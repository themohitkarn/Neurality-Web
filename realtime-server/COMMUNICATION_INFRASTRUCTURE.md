# Neurality Communication Infrastructure (v3.0)

## Overview
This document outlines the architecture of the decoupled communication subsystem, migrated from the Flask monolith to a standalone Node.js/TypeScript/PostgreSQL/Redis stack.

## 🏗 Architecture Components
### 1. Communication Backend (Node.js + TS)
- **Engine**: Socket.IO for bidirectional realtime sync.
- **API**: Express.js for message history and administrative tasks.
- **Scaling**: Redis Adapter for horizontal scalability and socket deduplication.

### 2. Dedicated Database (Neon PostgreSQL)
- **Role**: Source of truth for all persistent messaging data.
- **Key Tables**:
    - `conversations`: Logic for 1:1, Group, Secret, and Vanish modes.
    - `messages`: UUID-based storage with rich metadata (reactions, replies, edits).
    - `scheduled_messages`: Future message queue.
    - `media_attachments`: Chat-specific binary metadata.

### 3. Realtime Cache (Upstash Redis)
- **Presence**: High-frequency online/offline status with 5-minute TTL.
- **RTC Sessions**: Temporary signaling state and room management.
- **Rate Limiting**: Event-based rate limiting to prevent abuse.

## 🚀 Key Features Integrated
- **Swipe to Reply / Threads**: Handled via `reply_to_id` in the `messages` table.
- **Vanish Mode**: Auto-expiry via `expires_at` field and realtime socket sync.
- **Scheduled Messages**: Automated cron task (`node-cron`) checking every minute.
- **Edit History**: Tracked in `message_edits` table for transparency.
- **WebRTC Signaling**: Resilient signaling with Redis session recovery.

## 🔄 Migration Strategy
### Phase 1: Database Setup
1. Provision Neon PostgreSQL and Upstash Redis.
2. Run `npx prisma db push` in `realtime-server`.

### Phase 2: Backend Cutover
1. Update Flask to disable SocketIO listeners for messaging.
2. Update Frontend `SOCKET_URL` to point to port `5001`.
3. Switch message fetching from `chatApi.getMessages` (Flask) to the new Node.js REST endpoints.

### Phase 3: Data Integrity
- Use `user_id` (Integer) from the Main DB as the foreign reference in the Communication DB. No direct foreign keys; integrity is managed at the application layer.

## 📊 Comparison Analysis
| Feature | Old Architecture (Flask + SQLite) | New Architecture (Node + Postgres + Redis) |
| :--- | :--- | :--- |
| **Stability** | High write contention; socket crashes | Isolated workloads; distributed scaling |
| **Latency** | Medium (Thread-based) | Ultra-low (Event-loop based) |
| **Scaling** | Vertical only | Horizontal (via Redis Pub/Sub) |
| **History** | Limited by SQLite concurrency | Optimized PostgreSQL indexing |
| **Calling** | High race conditions | Redis-managed session recovery |

## 🛠 Scalability & Future
The architecture is now **SFU-ready**. To scale video calling for larger groups, an SFU (like Mediasoup or LiveKit) can be easily plugged into the Node.js server as a separate module without affecting the Flask backend.
