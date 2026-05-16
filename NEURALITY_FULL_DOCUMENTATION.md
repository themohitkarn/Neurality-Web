# Neurality: Full A to Z Project Documentation

Neurality is a premium, full-stack social media platform inspired by Instagram, architected with a modern, decoupled infrastructure to support high-performance social interactions, cinematic realtime communication, and AI-driven features.

---

## 1. Project Vision
Neurality aims to provide an immersive, mobile-first social experience that combines traditional social media (Feeds, Reels, Stories) with cutting-edge communication tools (WebRTC Calling, AI-moderated Chat) and a premium, high-fidelity UI/UX.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Capacitor (Mobile Support) |
| **Backend (Core)** | Flask, SQLAlchemy, JWT, Bcrypt, FFmpeg (Video Processing) |
| **Realtime Engine** | Node.js, TypeScript, Socket.IO, Redis (Adapter & Cache) |
| **Databases** | SQLite/MySQL (Core), Neon PostgreSQL (Messaging), Redis (Presence & Pub/Sub) |
| **AI Integration** | Google Gemini API (Captioning, Moderation, Reply Suggestions) |
| **Infrastructure** | Docker (Redis), BullMQ (Job Queues), Node-Cron |

---

## 3. Project Structure

```text
santagram/
├── backend/                # Flask Monolith (API, Auth, Social Logic)
│   ├── models/             # SQLAlchemy Models
│   ├── routes/             # Blueprint-based API Routes
│   ├── sockets/            # Legacy Socket Handlers (being migrated)
│   ├── utils/              # AI, Image, and Video Handlers
│   └── static/uploads/     # Local Media Storage
├── realtime-server/        # Node.js Microservice (Messaging, Presence, RTC)
│   ├── src/
│   │   ├── handlers/       # Modular Socket.IO Event Handlers
│   │   ├── middlewares/    # JWT Auth for Sockets
│   │   └── queues/         # BullMQ Workers (AI processing, Scheduling)
│   └── prisma/             # PostgreSQL Schema & Client
├── frontend/               # React + Vite Application
│   ├── src/
│   │   ├── components/     # High-fidelity UI Components
│   │   ├── hooks/          # useWebRTC, useSocket, useAuth
│   │   └── pages/          # Feed, Reels, Profile, Chat, Admin
├── docker-compose.yml      # Infrastructure (Redis)
└── README.md               # Project Entry Documentation
```

---

## 4. Core Features

### 📸 Social Core
- **Feed & Reels**: Infinite scroll feed with carousel posts and vertical video reels.
- **Stories**: Temporary 24-hour content with "Close Friends" and privacy controls.
- **AI Captions**: Automated caption generation for posts using Gemini AI.
- **Engagement**: Like/Unlike, Threaded Comments, and Follow/Unfollow system.

### 💬 Cinematic Communication
- **Realtime Chat**: Low-latency messaging with typing indicators, read receipts, and reactions.
- **Advanced Messaging**: Vanish mode, scheduled messages, and message editing.
- **WebRTC Calling**: P2P encrypted Audio and Video calls with resilient signaling.
- **Presence**: Accurate online/offline/away status tracking via Redis.

### 🤖 AI Pipeline
- **Auto-Moderation**: Background toxicity and spam checks for messages using BullMQ and Gemini.
- **Smart Replies**: AI-suggested quick responses based on chat context.

---

## 5. Technical Architecture

### 5.1 Realtime Communication Flow
Neurality uses a decoupled signaling server to orchestrate P2P WebRTC connections.

```mermaid
sequenceDiagram
    participant A as User A
    participant RS as Realtime Server (Node)
    participant B as User B
    
    A->>RS: Connect (JWT Auth)
    RS->>RS: Store Presence (Redis)
    RS-->>B: Presence Update (Online)
    
    Note over A, B: Messaging Flow
    A->>RS: message:send (Conversation X)
    RS->>RS: Persist to Postgres (Prisma)
    RS->>RS: Queue AI Check (BullMQ)
    RS-->>B: message:received
    
    Note over A, B: Calling Flow (WebRTC)
    A->>RS: call:initiate (Offer + Signal)
    RS-->>B: call:incoming (Signal)
    B->>RS: call:accept (Answer + Signal)
    RS-->>A: call:accepted (Signal)
    A<->B: P2P Encrypted Media Stream
```

---

## 6. Database Design

### 6.1 Main DB (Core Social)
Managed by SQLAlchemy, stores the primary social graph.
- **Users**: Auth, Profile, Settings, FCM Tokens.
- **Posts/Reels/Stories**: Media paths, captions, metadata.
- **Engagements**: Follows, Likes, Comments.

### 6.2 Realtime DB (Communication)
Managed by Prisma (PostgreSQL), optimized for high-concurrency messaging.
- **Conversations**: Direct, Group, and Secret chat metadata.
- **Messages**: rich content, delivery states, and relational links (replies/reactions).
- **Presence Sessions**: Active socket sessions for multi-device support.

---

## 7. Setup & Installation

### 7.1 Infrastructure
1. Start Redis: `docker-compose up -d`

### 7.2 Backend (Flask)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py  # Populate initial social data
python app.py   # Runs on :5000
```

### 7.3 Realtime Server (Node)
```bash
cd realtime-server
npm install
npx prisma db push
npm run dev     # Runs on :5001
```

### 7.4 Frontend (React)
```bash
cd frontend
npm install
npm run dev     # Runs on :5173
```

---

## 8. API & Socket Reference

### 8.1 Key API Endpoints
- `POST /api/auth/login`: Issue JWT token.
- `GET /api/posts/feed`: Paginated social feed.
- `GET /api/chat/messages/:id`: Fetch history from Node server.

### 8.2 Key Socket Events
- **Presence**: `presence:heartbeat`, `presence:update`.
- **Chat**: `message:send`, `message:received`, `message:typing`, `reaction:toggle`.
- **Calling**: `call:initiate`, `call:incoming`, `call:accept`, `call:signal`.

---

## 9. Security & Scalability
- **Security**: DTLS/SRTP for media, JWT for all socket/API auth, Argon2 for password hashing.
- **Scalability**: Horizontal socket scaling via Redis Pub/Sub; Decoupled workers for heavy AI tasks.
- **Storage**: Relative paths in DB with dynamic URL building; local storage mapped for dev, S3-ready for prod.

---
*Generated by Antigravity AI - Neurality Engineering Assistant*
