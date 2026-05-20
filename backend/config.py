import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


class Config:
    _secret = os.getenv("SECRET_KEY")
    if not _secret:
        raise RuntimeError("SECRET_KEY is missing in environment variables")
    SECRET_KEY = _secret
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)

    _db_url = os.getenv("DATABASE_URL")
    if not _db_url:
        raise RuntimeError("DATABASE_URL is missing in environment variables")
    SQLALCHEMY_DATABASE_URI = _db_url.replace("postgres://", "postgresql://", 1) # Support Heroku/Neon styles

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH_MB", "150")) * 1024 * 1024
    JWT_EXPIRES_IN_DAYS = int(os.getenv("JWT_EXPIRES_IN_DAYS", "7"))

    _cors = os.getenv("CORS_ORIGINS")
    if not _cors:
        raise RuntimeError("CORS_ORIGINS is missing in environment variables")
    
    CORS_ORIGINS = [
        origin.strip()
        for origin in _cors.split(",")
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
    
    # ── Resend Email Config ──
    ENABLE_REAL_EMAILS = os.getenv("ENABLE_REAL_EMAILS", "true").lower() == "true"
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")

    # ── Twilio SMS Config ──
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
    ENABLE_REAL_SMS = os.getenv("ENABLE_REAL_SMS", "false").lower() == "true"
