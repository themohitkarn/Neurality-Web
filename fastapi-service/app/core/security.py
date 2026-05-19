import jwt
import bcrypt
import logging
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger("fastapi-app")

# Secure signing credentials
JWT_SECRET_KEY = "neurality_realtime_super_secret_signing_key_2026"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def hash_password(password: str) -> str:
    """Securely hash plain-text password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hashed representation using bcrypt."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False

def create_access_token(user_id: int, username: str, session_id: str) -> str:
    """Create a signed JWT access token containing identity claims."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "username": username,
        "session_id": session_id,
        "type": "access",
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4())
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: int, session_id: str) -> str:
    """Create a signed JWT refresh token for session renewals."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "session_id": session_id,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4())  # Unique Token ID for rotation tracking
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict | None:
    """Decode and validate a signed JWT token, verifying signature and expiration."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT validation failed: Token signature expired.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT validation failed: Invalid token ({str(e)}).")
        return None
