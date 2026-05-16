# Neurality Database Architecture & Schema Documentation

This document provides a comprehensive technical overview of the database architecture powering the Neurality social media platform. It covers the schema design, relational mapping, media storage strategy, and performance optimizations required for a high-scale social application.

---

## 1. Database Overview

Neurality utilizes a relational database (MySQL/PostgreSQL) managed through **SQLAlchemy ORM**. The architecture is designed for high read-to-write ratios, characteristic of social media platforms.

- **Primary Database**: MySQL 8.0+ or PostgreSQL 14+
- **ORM**: SQLAlchemy (Flask-SQLAlchemy)
- **Migration Tool**: Flask-Migrate (Alembic)
- **Scaling Strategy**: 
    - **Read Replicas**: To offload complex feed queries.
    - **Vertical Scaling**: For the primary write instance.
    - **Horizontal Sharding**: Planned for the `messages` and `notifications` tables as the platform grows.

---

## 2. Core Tables & Schema

### 2.1 User System (`users`)
The `users` table is the central hub, storing authentication, profile, and preference data.

| Column | Type | Description |
|:---|:---|:---|
| `id` | INT (PK) | Unique identifier. |
| `username` | VARCHAR(50) | Unique display name (Indexed). |
| `email` | VARCHAR(120) | Unique user email (Indexed). |
| `password_hash` | VARCHAR(255) | Argon2 or Bcrypt hashed password. |
| `profile_pic` | VARCHAR(255) | Path/URL to the profile image. |
| `is_private` | BOOLEAN | Toggles public/private profile visibility. |
| `fcm_token` | VARCHAR(255) | Firebase Cloud Messaging token for push notifications. |
| `last_active` | DATETIME | Realtime presence tracking. |
| `is_verified` | BOOLEAN | Blue-badge status indicator. |

**Relationships**:
- One-to-Many: `posts`, `reels`, `stories`, `comments`.
- Many-to-Many: `followers` (Self-referential), `liked_posts`, `saved_posts`.

### 2.2 Posts & Media System
Neurality supports carousel posts, reels, and temporary stories.

#### `posts` Table
- `user_id`: FK to `users.id`.
- `caption`: VARCHAR(500).
- `created_at`: Indexed for feed performance.

#### `post_images` (Carousel Support)
Supports multiple images/videos per post.
- `post_id`: FK to `posts.id`.
- `image_path`: Path to media.
- `position`: Order in the carousel.

#### `reels` Table
Vertical video system.
- `video_path`: Path to the video file.
- `thumbnail_path`: Static cover image.
- `aspect_ratio`: Metadata for optimized rendering.

#### `stories` Table
- `expires_at`: Managed by a background task for auto-deletion/archiving.
- `story_privacy`: Supports "Close Friends" filtering.

---

## 3. Communication System (Chat & Groups)

The messaging architecture supports Direct Messages (DMs) and Group Chats with realtime synchronization.

### 3.1 `messages` Table
| Column | Type | Description |
|:---|:---|:---|
| `sender_id` | INT | FK to `users.id`. |
| `receiver_id` | INT | FK to `users.id` (NULL for groups). |
| `group_id` | INT | FK to `groups.id` (NULL for DMs). |
| `content` | TEXT | Message body. |
| `message_type` | VARCHAR | `text`, `voice`, `image`. |
| `reply_to_id` | INT | Recursive FK for threaded replies. |
| `is_read` | BOOLEAN | Read receipt indicator. |

### 3.2 `groups` & `group_members`
- `groups`: Stores metadata like `name`, `group_pic`, and `creator_id`.
- `group_members`: Junction table with `role` (admin/member) and `joined_at`.

---

## 4. Social Graph (Follows & Engagement)

### 4.1 `followers` (Junction Table)
Implements a directed graph for following relationships.
- `follower_id`: The user who follows.
- `followed_id`: The user being followed.

### 4.2 `follow_requests`
Handles private account logic. Requests transition from `pending` to `accepted` or are deleted on rejection.

### 4.3 Likes & Reactions
- `post_likes` / `reel_likes`: Standard M2M engagement tracking.
- `message_reactions`: Stores emoji reactions (`emoji` column) mapped to `message_id` and `user_id`.

---

## 5. Notification System (`notifications`)

Notifications are generated on every social interaction.

| Column | Type | Description |
|:---|:---|:---|
| `user_id` | INT | Recipient. |
| `actor_id` | INT | User who triggered the notification. |
| `type` | VARCHAR | `like`, `comment`, `follow`, `mention`, etc. |
| `target_type` | VARCHAR | `post`, `reel`, `story`, `comment`. |
| `target_id` | INT | ID of the target object. |
| `is_read` | BOOLEAN | UI unread indicator. |

---

## 6. Media Storage Architecture

**CRITICAL**: Media files (images, videos, voice notes) are **NOT** stored in the database as BLOBS.

### Current Strategy (Local Development)
- Files are stored in a dedicated `static/uploads` directory on the server.
- The database stores only the **relative file path**.
- A utility function (`build_media_url`) dynamically prepends the server domain to the path for frontend consumption.

### Production Roadmap (Scalable)
1.  **Object Storage (S3/GCS)**: Migrate all media to AWS S3 or Google Cloud Storage.
2.  **CDN Integration (Cloudfront/Cloudflare)**: Serve media from edge locations to reduce latency.
3.  **Cloudinary/Mux**: Offload video transcoding for Reels to a specialized service to handle various bitrates and formats.

---

## 7. Realtime Integration (Socket.IO & WebRTC)

The database interacts with the realtime layer in three primary ways:

1.  **Persistence-First**: For messages, the data is saved to the DB *before* being emitted via Socket.IO. This ensures no data loss if a socket disconnects.
2.  **Presence Tracking**: The `last_active` field in the `users` table is updated on socket connect/disconnect.
3.  **Signaling**: WebRTC "Offer/Answer" exchanges are transient and **NOT** stored in the database; they reside in-memory within the signaling server.

---

## 8. Indexing & Performance Optimization

To ensure a "Zero Lag" experience, the following optimizations are implemented:

- **Composite Indexes**:
    - `(follower_id, followed_id)` on the `followers` table.
    - `(user_id, is_read, created_at)` on the `notifications` table for fast unread counts.
- **Pagination**: All feeds (Home, Reels, Search) use **Cursor-based pagination** (using `created_at` or `id`) rather than `OFFSET` to maintain performance at scale.
- **Eager Loading**: Using SQLAlchemy `joinedload` or `subqueryload` for relationships (like `author` and `likes`) to prevent the N+1 query problem.

---

## 9. Security Architecture

- **Password Hashing**: Uses `bcrypt` for secure, salted password storage.
- **JWT (JSON Web Tokens)**: Stateless authentication. The DB is only hit once during login; subsequent requests validate the token signature.
- **Row-Level Security (Application Layer)**: Every query checks `is_private` status and `followers` relationship before returning sensitive data.
- **Data Sanitization**: SQLAlchemy ORM automatically prevents SQL Injection through parameterized queries.

---

## 10. Future Scalability Roadmap

1.  **Caching Layer (Redis)**: Cache user profiles, follower counts, and the latest posts to reduce DB load.
2.  **Search Engine (Elasticsearch)**: Offload complex text-based searches (user stalking, post hashtags) to a dedicated search index.
3.  **Time-Series DB**: Use InfluxDB or TimescaleDB for advanced analytics (post reach, reel engagement metrics).
4.  **Database Sharding**: Distribute the `messages` table across multiple database nodes based on `user_id` or `group_id`.

---

*Document Version: 1.1.0*
*Last Updated: 2026-05-13*
*Author: Neurality Data Engineering Team*
