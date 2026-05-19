import logging
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc
from typing import List, Optional
from app.core.db import get_db
from app.core.auth_deps import get_current_user
from app.models.user import User
from app.models.notification import Notification, NotificationPreference
from app.schemas.notification import (
    NotificationResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    TriggerNotificationRequest
)
from app.core.notification_service import NotificationService
from app.core.kafka import kafka_manager

logger = logging.getLogger("fastapi-app")

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve paginated notifications list for the authenticated user, ordered by created_at DESC."""
    user_id = str(current_user.id)
    try:
        query = select(Notification)\
            .where(Notification.user_id == user_id)\
            .order_by(desc(Notification.created_at))\
            .limit(limit)\
            .offset(offset)
        res = await db.execute(query)
        notifications = res.scalars().all()
        return notifications
    except Exception as e:
        logger.error(f"Error fetching notifications for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database fetch error")

@router.post("/read")
async def mark_notifications_read(
    notification_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a single notification or all notifications as read for the current user."""
    user_id = str(current_user.id)
    try:
        if notification_id is not None:
            # Mark single notification as read, validating ownership
            query = update(Notification)\
                .where(Notification.id == notification_id, Notification.user_id == user_id)\
                .values(is_read=True)\
                .execution_options(synchronize_session="fetch")
            await db.execute(query)
        else:
            # Mark all notifications as read for this user
            query = update(Notification)\
                .where(Notification.user_id == user_id)\
                .values(is_read=True)\
                .execution_options(synchronize_session="fetch")
            await db.execute(query)
        
        await db.commit()
        return {"status": "success", "message": "Notification read-state updated successfully"}
    except Exception as e:
        logger.error(f"Error updating read-state for user {user_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database write error")

@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the count of unread notifications for the authenticated user."""
    user_id = str(current_user.id)
    try:
        query = select(func.count())\
            .select_from(Notification)\
            .where(Notification.user_id == user_id, Notification.is_read == False)
        res = await db.execute(query)
        count = res.scalar() or 0
        return {"unread_count": count}
    except Exception as e:
        logger.error(f"Error getting unread count for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database query error")

@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user)
):
    """Fetch the notification preferences configuration for the authenticated user."""
    user_id = str(current_user.id)
    pref = await NotificationService.get_or_create_preferences(user_id)
    return pref

@router.post("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    payload: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update notification channels and quiet hours preferences for the authenticated user."""
    user_id = str(current_user.id)
    try:
        # Get existing or seed
        pref = await NotificationService.get_or_create_preferences(user_id)
        
        query = select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        res = await db.execute(query)
        db_pref = res.scalar_one()

        if payload.push_enabled is not None:
            db_pref.push_enabled = payload.push_enabled
        if payload.websocket_enabled is not None:
            db_pref.websocket_enabled = payload.websocket_enabled
        if payload.email_enabled is not None:
            db_pref.email_enabled = payload.email_enabled
        if payload.quiet_hours_start is not None:
            db_pref.quiet_hours_start = payload.quiet_hours_start
        if payload.quiet_hours_end is not None:
            db_pref.quiet_hours_end = payload.quiet_hours_end

        await db.commit()
        await db.refresh(db_pref)
        return db_pref
    except Exception as e:
        logger.error(f"Error updating preferences for user {user_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database write error")

@router.post("/trigger")
async def trigger_mock_notification(
    payload: TriggerNotificationRequest
):
    """Convenience endpoint to simulate event creation: publishes 'notification.created' payload directly to Kafka."""
    try:
        event = {
            "user_id": payload.user_id,
            "type": payload.type,
            "title": payload.title,
            "body": payload.body,
            "actor_id": payload.actor_id,
            "payload_json": payload.payload_json
        }
        event_str = json.dumps(event)
        
        logger.info(f"[HTTP TRIGGER] Producing mock notification to Kafka for user '{payload.user_id}'...")
        await kafka_manager.send_event(
            key=payload.user_id,
            value=event_str,
            topic="notification.created"
        )
        return {"status": "success", "message": "Notification event published to Kafka successfully."}
    except Exception as e:
        logger.error(f"Error producing notification trigger: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to produce to Kafka: {str(e)}")
