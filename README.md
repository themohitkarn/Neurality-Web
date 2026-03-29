# Neurality

Neurality is a full-stack social media platform inspired by Instagram, built with React + Vite + Tailwind on the frontend and Flask + SQLAlchemy + MySQL on the backend.

## Stack

- Frontend: React, Vite, Tailwind CSS, Axios, React Router
- Backend: Flask, Flask-SQLAlchemy, Flask-Bcrypt, JWT, Flask-CORS
- Database: MySQL via SQLAlchemy ORM
- Storage: Local filesystem under `backend/static/uploads`

## Features

- JWT signup/login with password hashing
- Protected routes and session restore
- Profile photos, post uploads, and story uploads
- Feed API with pagination and infinite scroll UI
- Like/unlike toggle with duplicate protection
- Comment create/delete with ownership checks
- Profile pages with follow/unfollow
- Search users from the navbar
- Basic stories that expire after 24 hours
- AI caption generation with Gemini
- Reels upload/feed with ffmpeg compression and thumbnails
- Real-time chat with Flask-SocketIO and Socket.IO client
- Recommendation engine powered by likes, comments, and follows
- Full settings center with dark mode, privacy, notifications, and profile editing
- Distinct mobile shell with bottom navigation and mobile-first chat/feed flow
- Reel uploads up to 3 minutes with higher upload limits and broader format support

## Project Structure

```text
backend/
frontend/
README.md
```

## Backend Setup

1. Create a MySQL database named `neurality`.
2. Copy `backend/.env.example` to `backend/.env` and update credentials if needed.
3. Install dependencies:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

4. Run the API:

```bash
python app.py
```

The backend runs on `http://localhost:5000`.

Required backend extras for the new features:

- `GEMINI_API_KEY` in `backend/.env` for AI caption generation
- `ffmpeg` installed and available on `PATH` for reel processing
- `MAX_CONTENT_LENGTH_MB`, `MAX_VIDEO_UPLOAD_MB`, and `MAX_VIDEO_DURATION_SECONDS` for larger reel uploads

## Frontend Setup

1. Copy `frontend/.env.example` to `frontend/.env` if you want to override the API URL.
2. Install dependencies:

```bash
cd frontend
npm install
```

3. Run the Vite dev server:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Sample Data

Seed the database with demo accounts, sample posts, comments, likes, follows, and generated SVG media:

```bash
cd backend
python seed.py
```

Demo login after seeding:

- `santa@neurality.dev / northpole123`
- `ginger@neurality.dev / cookies123`
- `blitzen@neurality.dev / reindeer123`

## API Endpoints

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### User

- `GET /api/user/<id>`
- `GET /api/user/me`
- `PUT /api/user/me`
- `GET /api/user/settings`
- `PUT /api/user/settings`
- `POST /api/user/follow/<id>`
- `GET /api/user/search?q=<term>`

### Posts

- `POST /api/posts/create`
- `GET /api/posts/feed?page=1&per_page=6`
- `POST /api/posts/like/<id>`
- `GET /api/posts/recommended?limit=6`

### AI

- `POST /api/ai/caption`

### Reels

- `POST /api/reels/upload`
- `GET /api/reels/feed`
- `POST /api/reels/like/<id>`

### Comments

- `POST /api/comments/add`
- `DELETE /api/comments/<id>`

### Stories

- `POST /api/stories/create`
- `GET /api/stories/feed`

### Chat

- `GET /api/chat/users`
- `GET /api/chat/messages/<id>`
- Socket events: `send_message`, `receive_message`, `typing_indicator`

## Database Schema

- SQL DDL: [backend/schema.sql](/d:/neurality/backend/schema.sql)
- ORM models: [backend/models/user.py](/d:/neurality/backend/models/user.py), [backend/models/post.py](/d:/neurality/backend/models/post.py), [backend/models/comment.py](/d:/neurality/backend/models/comment.py), [backend/models/story.py](/d:/neurality/backend/models/story.py), [backend/models/reel.py](/d:/neurality/backend/models/reel.py), [backend/models/message.py](/d:/neurality/backend/models/message.py)

## Notes

- Uploaded images are stored in `backend/static/uploads/avatars`, `backend/static/uploads/posts`, and `backend/static/uploads/stories`.
- `app.py` creates tables automatically on start-up for local development.
- If the feed is empty, seed the backend or create a first post from the app.
