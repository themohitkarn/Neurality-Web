from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.db import get_db
from app.models.user_settings import UserSettings
from app.schemas.user_settings import UserSettingsUpdate, UserSettingsResponse
from app.core.redis import redis_manager
from app.core.auth_deps import get_current_user
from app.models.user import User
import logging

logger = logging.getLogger("fastapi-app")

router = APIRouter(prefix="/settings", tags=["user-settings"])

def get_cache_key(user_id: str) -> str:
    """Standardized cache key structure."""
    return f"settings:{user_id}"

@router.get("/metrics")
async def get_metrics():
    """Retrieve observability metrics for the distributed WebSocket sync cluster."""
    from app.core import redis as redis_module
    from app.core.websocket import ws_manager

    avg_latency = (redis_module.PUB_SUB_LATENCY_SUM / redis_module.PUB_SUB_EVENTS_COUNT) if redis_module.PUB_SUB_EVENTS_COUNT > 0 else 0.0

    return {
        "pubsub_avg_latency_ms": avg_latency,
        "pubsub_events_total": redis_module.PUB_SUB_EVENTS_COUNT,
        "subscriber_reconnects": redis_module.SUBSCRIBER_RECONNECTS,
        "cross_instance_broadcasts": redis_module.CROSS_INSTANCE_BROADCASTS,
        "websocket_fanout_counts": redis_module.LOCAL_FANOUT_COUNTS,
        "dropped_delivery_count": redis_module.DROPPED_DELIVERIES,
        "active_local_users": len(ws_manager.active_connections),
        "active_local_sockets": sum(len(s) for s in ws_manager.active_connections.values())
    }

@router.get("/{user_id}", response_model=UserSettingsResponse)
async def get_settings(user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve user settings via write-through cache check, or seeds standard row if absent."""
    # Enforce strict user ownership validation
    if str(current_user.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access these settings."
        )

    # Enforce privacy block checks (reject settings sync visibility)
    from app.core.privacy_service import PrivacyService
    if await PrivacyService.is_blocked(str(current_user.id), user_id) or await PrivacyService.is_blocked(user_id, str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Settings sync visibility rejected. Relationship blocked."
        )

    cache_key = get_cache_key(user_id)
    
    # 1. Read-Through: Look up in Redis cache first
    try:
        cached_data = await redis_manager.get_json(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Servicing request for user '{user_id}' from Redis.")
            return cached_data
    except Exception as e:
        logger.error(f"Redis lookup failed at GET settings: {str(e)}")

    # 2. Database Lookup on Cache Miss
    logger.info(f"[CACHE MISS] querying PostgreSQL database for user '{user_id}'...")
    query = select(UserSettings).where(UserSettings.user_id == user_id)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    # 3. Seed Default Record if user settings do not exist
    if not settings:
        logger.info(f"User '{user_id}' settings record not found. Seeding default configurations...")
        settings = UserSettings(
            user_id=user_id,
            theme="dark",
            email_notifications=True,
            push_notifications=True,
            language="en",
            version=1
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    # Convert model to response dictionary for write-through caching
    settings_dict = {
        "user_id": settings.user_id,
        "theme": settings.theme,
        "email_notifications": settings.email_notifications,
        "push_notifications": settings.push_notifications,
        "language": settings.language,
        "version": settings.version,
        "updated_at": settings.updated_at.isoformat()
    }

    # 4. Write-Through: Cache in Redis asynchronously (TTL: 86400 seconds)
    try:
        await redis_manager.set_json(cache_key, settings_dict, ttl=86400)
    except Exception as e:
        logger.error(f"Failed to seed Redis cache on GET request: {str(e)}")

    return settings

@router.post("/update", response_model=UserSettingsResponse)
async def update_settings(payload: UserSettingsUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Perform optimistic concurrency controlled (OCC) atomic update."""
    # Enforce strict user ownership validation on updates/replays
    if str(current_user.id) != payload.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update these settings."
        )

    cache_key = get_cache_key(payload.user_id)

    # 1. Try atomic update checking if version matches expected_version
    stmt = (
        update(UserSettings)
        .where(UserSettings.user_id == payload.user_id)
        .where(UserSettings.version == payload.expected_version)
        .values(
            theme=payload.theme,
            email_notifications=payload.email_notifications,
            push_notifications=payload.push_notifications,
            language=payload.language,
            version=UserSettings.version + 1
        )
    )

    update_result = await db.execute(stmt)
    
    if update_result.rowcount == 0:
        # Check if record exists (if it doesn't, we create it. If it does, there's a version mismatch)
        check_query = select(UserSettings).where(UserSettings.user_id == payload.user_id)
        check_res = await db.execute(check_query)
        current_settings = check_res.scalar_one_or_none()

        if current_settings:
            logger.warning(
                f"[OCC VERSION CONFLICT] User '{payload.user_id}' update rejected. "
                f"Expected: {payload.expected_version} | Actual in DB: {current_settings.version}"
            )
            # Raise 409 Conflict with detailed context
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "VERSION_CONFLICT",
                    "current_version": current_settings.version,
                    "current_state": {
                        "theme": current_settings.theme,
                        "email_notifications": current_settings.email_notifications,
                        "push_notifications": current_settings.push_notifications,
                        "language": current_settings.language
                    }
                }
            )
        else:
            # Seed new configurations since it's the first time
            logger.info(f"User '{payload.user_id}' settings absent. Seeding record with version=1...")
            settings = UserSettings(
                user_id=payload.user_id,
                theme=payload.theme,
                email_notifications=payload.email_notifications,
                push_notifications=payload.push_notifications,
                language=payload.language,
                version=1
            )
            db.add(settings)
            await db.commit()
            await db.refresh(settings)
    else:
        # Commit the transaction and reload the settings model to get latest values
        await db.commit()
        query = select(UserSettings).where(UserSettings.user_id == payload.user_id)
        result = await db.execute(query)
        settings = result.scalar_one()
        logger.info(f"[OCC SUCCESS] Settings updated successfully to version: {settings.version}")

    # Convert model to dictionary structure
    settings_dict = {
        "user_id": settings.user_id,
        "theme": settings.theme,
        "email_notifications": settings.email_notifications,
        "push_notifications": settings.push_notifications,
        "language": settings.language,
        "version": settings.version,
        "updated_at": settings.updated_at.isoformat()
    }

    # 2. Write-Through Caching: Save in Redis
    await redis_manager.set_json(cache_key, settings_dict, ttl=86400)

    # 3. Kafka Event: Broadcast to settings topic
    try:
        import json
        from app.core.kafka import kafka_manager
        event_payload = json.dumps(settings_dict)
        await kafka_manager.send_event(key=settings.user_id, value=event_payload)
        logger.info(f"Successfully published settings update event to Kafka for user: {settings.user_id}")
    except Exception as e:
        logger.error(f"Failed to publish settings update event to Kafka: {str(e)}")

    return settings
