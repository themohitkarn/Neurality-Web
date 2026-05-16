import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "neurality-dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/neurality_main",
    ).replace("postgres://", "postgresql://", 1) # Support Heroku/Neon styles
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH_MB", "150")) * 1024 * 1024
    JWT_EXPIRES_IN_DAYS = int(os.getenv("JWT_EXPIRES_IN_DAYS", "7"))
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    MAX_VIDEO_UPLOAD_MB = int(os.getenv("MAX_VIDEO_UPLOAD_MB", "150"))
    MAX_VIDEO_DURATION_SECONDS = int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "180"))
    FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")
    FFPROBE_BINARY = os.getenv("FFPROBE_BINARY", "ffprobe")
    UPLOAD_FOLDER = BASE_DIR / "static" / "uploads"
    AVATAR_FOLDER = UPLOAD_FOLDER / "avatars"
    POST_FOLDER = UPLOAD_FOLDER / "posts"
    STORY_FOLDER = UPLOAD_FOLDER / "stories"
    VIDEO_FOLDER = BASE_DIR / "static" / "videos"
    REEL_VIDEO_FOLDER = VIDEO_FOLDER / "reels"
    VIDEO_THUMBNAIL_FOLDER = VIDEO_FOLDER / "thumbnails"
    VIDEO_TEMP_FOLDER = VIDEO_FOLDER / "tmp"
