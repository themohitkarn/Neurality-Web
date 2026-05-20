import os
import redis
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from celery import Celery

# ── Extension Instances ──
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
bcrypt = Bcrypt()
cors = CORS()

REDIS_URL = os.environ.get("REDIS_URL")

# ── Validate Redis is actually reachable before using it ──
_redis_available = False
if REDIS_URL:
    try:
        _test = redis.from_url(REDIS_URL, socket_connect_timeout=3)
        _test.ping()
        _redis_available = True
        print(f"[Neurality] Redis connected: {REDIS_URL[:30]}...")
    except Exception as e:
        print(f"[Neurality] Redis unavailable ({e}), falling back to in-memory storage")
        _redis_available = False

# ── Rate Limiter (in-memory fallback if no Redis) ──
limiter_kwargs = {
    "key_func": get_remote_address,
    "default_limits": ["200 per hour"]
}
if _redis_available:
    limiter_kwargs["storage_uri"] = REDIS_URL

limiter = Limiter(**limiter_kwargs)

# ── Redis Client (None if unavailable) ──
redis_client = redis.from_url(REDIS_URL) if _redis_available else None

# ── Socket.IO ──
socket_kwargs = {
    "cors_allowed_origins": "*",
    "manage_session": False,
    "async_mode": "threading"
}

if _redis_available:
    socket_kwargs["message_queue"] = REDIS_URL

socketio = SocketIO(**socket_kwargs)

# ── Background Worker (Celery) ──
def make_celery(app_name):
    return Celery(
        app_name,
        broker=REDIS_URL if _redis_available else "memory://",
        backend=REDIS_URL if _redis_available else "cache+memory://",
        include=['tasks.media_tasks', 'tasks.notification_tasks']
    )

celery = make_celery("neurality")

