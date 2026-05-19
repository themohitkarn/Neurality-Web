from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.db import get_db
from app.core.security import decode_token
from app.core.redis import redis_manager
from app.models.user import User

logger = logging.getLogger("fastapi-app")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ====================================================
# PART 3, 6 & 8 — SECURE HTTP CURRENT USER RESOLVER
# ====================================================
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    """FastAPI dependency to extract, validate, and authorize requests using active Redis sessions."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Decode token and verify signature
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception
        
    user_id = payload.get("sub")
    session_id = payload.get("session_id")
    if not user_id or not session_id:
        raise credentials_exception
        
    # 2. Query Redis Session Store for instant token revocation
    session_key = f"session:{user_id}:{session_id}"
    session_state = await redis_manager.get_json(session_key)
    if not session_state or session_state.get("status") != "active":
        logger.warning(f"Access attempted with revoked or expired session: {session_key}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 3. Retrieve user from PostgreSQL database
    try:
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise credentials_exception
        return user
    except Exception as e:
        logger.error(f"Error querying user during token validation: {str(e)}")
        raise credentials_exception
