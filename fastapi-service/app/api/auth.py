from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import logging
from datetime import datetime

from app.core.db import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.core.redis import redis_manager
from app.core.auth_deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    TokenRefreshRequest,
    UserMe
)

logger = logging.getLogger("fastapi-app")

router = APIRouter(prefix="/auth", tags=["auth"])

# ====================================================
# PART 3 & 11 — SECURE USER REGISTRATION
# ====================================================
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account, securing the password with bcrypt."""
    # 1. Check for existing username or email
    existing_username = await db.execute(select(User).where(User.username == payload.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered."
        )

    existing_email = await db.execute(select(User).where(User.email == payload.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered."
        )

    # 2. Hash password and save user
    try:
        hashed = hash_password(payload.password)
        new_user = User(
            username=payload.username,
            email=payload.email,
            password_hash=hashed
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        logger.info(f"Successfully registered new user: '{payload.username}' (ID: {new_user.id})")
        return {"message": "User registered successfully", "user_id": new_user.id}
    except Exception as e:
        logger.error(f"Error during user registration: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to a database exception."
        )

# ====================================================
# PART 3 & 4 — USER LOGIN & SECURE SESSION SETUP
# ====================================================
@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate credentials, create a unique session ID, and generate secure tokens."""
    # 1. Fetch user by username or email
    result = await db.execute(
        select(User).where((User.username == payload.username) | (User.email == payload.username))
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(payload.password, user.password_hash):
        # Throttle / rate limit auth failures in real production
        logger.warning(f"Failed authentication attempt for username: '{payload.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    # 2. Establish session context
    session_id = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    
    # 3. Generate tokens
    access_token = create_access_token(user.id, user.username, session_id)
    # Re-use refresh_jti as JTI inside refresh token
    refresh_payload_expire = datetime.utcnow() + datetime.resolution * 7
    refresh_token = create_refresh_token(user.id, session_id)
    
    # Extract unique JTI from the generated refresh token
    decoded_refresh = decode_token(refresh_token)
    token_jti = decoded_refresh.get("jti") if decoded_refresh else refresh_jti

    # 4. Save session status and dynamic JTI to Redis
    session_key = f"session:{user.id}:{session_id}"
    session_data = {
        "status": "active",
        "username": user.username,
        "refresh_jti": token_jti,
        "created_at": datetime.utcnow().isoformat()
    }
    await redis_manager.set_json(session_key, session_data, ttl=604800) # 7 Days
    
    logger.info(f"User '{user.username}' successfully logged in. Session established: {session_id}")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

# ====================================================
# PART 3 & 7 — REFRESH TOKEN ROTATION (RTR)
# ====================================================
@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Perform Token Rotation (RTR). Detects token replay attacks and revokes compromises instantly."""
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user_id = decoded.get("sub")
    session_id = decoded.get("session_id")
    token_jti = decoded.get("jti")

    session_key = f"session:{user_id}:{session_id}"
    session_data = await redis_manager.get_json(session_key)

    # SECURE BREACH CHECK: If session is inactive, or the token JTI doesn't match the current active JTI,
    # it means this token is being replayed (breach!). Revoke the entire session instantly!
    if not session_data or session_data.get("status") != "active" or session_data.get("refresh_jti") != token_jti:
        if session_data:
            logger.critical(f"[SECURITY ALERT] Refresh token replay attack detected on session '{session_id}'! Revoking session.")
            await redis_manager.delete(session_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked or replayed. Please re-authenticate."
        )

    # RTR: Issue brand new access token and a brand new refresh token
    # Query user DB to get username
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    new_access_token = create_access_token(user.id, user.username, session_id)
    new_refresh_token = create_refresh_token(user.id, session_id)
    
    decoded_new = decode_token(new_refresh_token)
    new_jti = decoded_new.get("jti") if decoded_new else str(uuid.uuid4())

    # Update active session with the new JTI in Redis
    session_data["refresh_jti"] = new_jti
    await redis_manager.set_json(session_key, session_data, ttl=604800)

    logger.info(f"Rotated refresh token successfully for user ID {user_id} on session '{session_id}'.")
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

# ====================================================
# PART 3 & 7 — LOGOUT / SESSION REVOCATION
# ====================================================
@router.post("/logout")
async def logout(payload: TokenRefreshRequest):
    """Revoke session instantly, invalidating all outstanding access tokens immediately."""
    decoded = decode_token(payload.refresh_token)
    if not decoded:
        # Gracefully exit if token is completely unparsable
        return {"message": "Logged out successfully"}

    user_id = decoded.get("sub")
    session_id = decoded.get("session_id")
    
    session_key = f"session:{user_id}:{session_id}"
    await redis_manager.delete(session_key)
    
    logger.info(f"User ID {user_id} logged out. Session {session_id} successfully revoked.")
    return {"message": "Logged out successfully"}

# ====================================================
# GET /auth/me - PROFILE RETRIEVAL
# ====================================================
@router.get("/me", response_model=UserMe)
async def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve details of the securely authenticated caller."""
    return current_user

# ====================================================
# PART 3 — PRIVACY ENFORCEMENT ON PROFILE ACCESS
# ====================================================
@router.get("/profile/{user_id}", response_model=UserMe)
async def get_user_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve details of any user, rejecting access if a block is active between the users."""
    from app.core.privacy_service import PrivacyService
    caller_id = str(current_user.id)
    target_id = str(user_id)

    # Check Block (both ways: source blocks target or target blocks source)
    if await PrivacyService.is_blocked(caller_id, target_id) or await PrivacyService.is_blocked(target_id, caller_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You have blocked this user or they have blocked you."
        )

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user
