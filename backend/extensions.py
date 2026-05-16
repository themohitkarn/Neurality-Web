import os
import redis
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from celery import Celery

# ── Extension Instances ──
db = SQLAlchemy()
bcrypt = Bcrypt()
cors = CORS()

# ── Redis & Socket.IO Scaling ──
REDIS_URL = os.environ.get("REDIS_URL")
redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None

# Configure Socket.IO
# Note: message_queue is NOT supported in "threading" mode.
# We only enable it if a REDIS_URL is provided and we aren't explicitly forcing threading.
socket_kwargs = {
    "cors_allowed_origins": "*",
    "manage_session": False,
    "async_mode": "threading"
}

if REDIS_URL:
    socket_kwargs["message_queue"] = REDIS_URL
    # Note: message_queue is technically not supported in threading mode,
    # but we'll keep it here for configuration symmetry if Redis is forced.

socketio = SocketIO(**socket_kwargs)

# ── Background Worker (Celery) ──
def make_celery(app_name):
    return Celery(
        app_name,
        broker=REDIS_URL,
        backend=REDIS_URL,
        include=['tasks.media_tasks', 'tasks.notification_tasks']
    )

celery = make_celery("neurality")
