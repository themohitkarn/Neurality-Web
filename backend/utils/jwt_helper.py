from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request


import hashlib
import secrets
import uuid

def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()

def generate_access_token(user_id, session_id=None):
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=15), # Short-lived access token
    }
    if session_id:
        payload["session_id"] = session_id
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def generate_refresh_token_in_db(user_id, session_id):
    from extensions import db
    from models.device_session import DeviceSession

    # Cryptographically secure 64-character token
    token = secrets.token_hex(32)
    session = db.session.get(DeviceSession, session_id)
    if session:
        session.refresh_token = hash_token(token)
        db.session.commit()
        return token
    return None


def rotate_refresh_token(old_token):
    from extensions import db
    from models.device_session import DeviceSession

    session = DeviceSession.query.filter_by(refresh_token=hash_token(old_token)).first()
    if not session:
        return None, None

    # Rotate token to prevent replay attacks
    new_token = secrets.token_hex(32)
    session.refresh_token = hash_token(new_token)
    session.last_active = datetime.utcnow()
    db.session.commit()

    # Generate fresh access token
    new_access_token = generate_access_token(session.user_id, session_id=session.id)
    return new_access_token, new_token


def generate_token(user_id, session_id=None):
    # Backward compatibility helper
    return generate_access_token(user_id, session_id)


def decode_token(token):
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_bearer_token():
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def get_current_user_optional():
    from extensions import db
    from models.user import User
    from models.device_session import DeviceSession

    token = extract_bearer_token()
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    session_id = payload.get("session_id")
    if session_id:
        session_exists = db.session.get(DeviceSession, session_id)
        if not session_exists:
            return None

    return db.session.get(User, payload["user_id"])


def token_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return view_func(*args, **kwargs)

        from extensions import db
        from models.user import User
        from models.device_session import DeviceSession

        token = extract_bearer_token()
        if not token:
            return jsonify({"message": "Missing authorization token."}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"message": "Invalid or expired token."}), 401

        session_id = payload.get("session_id")
        if session_id:
            session_exists = db.session.get(DeviceSession, session_id)
            if not session_exists:
                return jsonify({"message": "Session expired or logged out."}), 401

        user = db.session.get(User, payload["user_id"])
        if not user:
            return jsonify({"message": "User not found."}), 404

        g.current_user = user
        # Save session_id in request context in case views need it
        g.current_session_id = session_id
        return view_func(*args, **kwargs)

    return wrapper
