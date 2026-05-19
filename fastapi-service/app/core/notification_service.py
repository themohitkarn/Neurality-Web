import logging
import asyncio
import json
from datetime import datetime
from sqlalchemy import select, update
from app.core.db import AsyncSessionLocal
from app.models.notification import Notification, NotificationDeliveryAttempt, NotificationPreference
from app.core.redis import redis_manager
from app.core.metrics import NotificationMetrics

logger = logging.getLogger("fastapi-app")

MAX_RETRIES = 3

class NotificationService:
    @staticmethod
    def is_in_quiet_hours(start: str | None, end: str | None, current: str) -> bool:
        """Check if current time string (HH:MM) is between start and end (supporting overnight boundaries)."""
        if not start or not end:
            return False
        try:
            sh, sm = map(int, start.split(":"))
            eh, em = map(int, end.split(":"))
            ch, cm = map(int, current.split(":"))
            
            start_min = sh * 60 + sm
            end_min = eh * 60 + em
            current_min = ch * 60 + cm
            
            if start_min <= end_min:
                return start_min <= current_min <= end_min
            else:
                # Overnight quiet hours, e.g., 22:00 to 08:00
                return current_min >= start_min or current_min <= end_min
        except Exception as e:
            logger.error(f"Error parsing quiet hours: {str(e)}")
            return False

    @staticmethod
    async def get_or_create_preferences(user_id: str) -> NotificationPreference:
        """Fetch notification preferences for a user, or seed default settings if missing."""
        async with AsyncSessionLocal() as session:
            try:
                query = select(NotificationPreference).where(NotificationPreference.user_id == user_id)
                res = await session.execute(query)
                pref = res.scalar_one_or_none()
                if pref:
                    return pref
                
                # Seed default preferences
                new_pref = NotificationPreference(
                    user_id=user_id,
                    push_enabled=True,
                    websocket_enabled=True,
                    email_enabled=True,
                    quiet_hours_start=None,
                    quiet_hours_end=None
                )
                session.add(new_pref)
                await session.commit()
                # Refresh to bind to active session
                await session.refresh(new_pref)
                return new_pref
            except Exception as e:
                logger.error(f"Error getting/creating preferences: {str(e)}")
                await session.rollback()
                # Return default memory fallback
                return NotificationPreference(
                    user_id=user_id,
                    push_enabled=True,
                    websocket_enabled=True,
                    email_enabled=True
                )

    @staticmethod
    async def create_notification(
        user_id: str,
        type_: str,
        title: str,
        body: str,
        actor_id: str | None = None,
        payload_json: dict | None = None
    ) -> Notification:
        """Create and persist a new notification in PostgreSQL."""
        async with AsyncSessionLocal() as session:
            try:
                notif = Notification(
                    user_id=user_id,
                    type=type_,
                    title=title,
                    body=body,
                    actor_id=actor_id,
                    payload_json=json.dumps(payload_json) if payload_json else None,
                    is_read=False
                )
                session.add(notif)
                await session.commit()
                await session.refresh(notif)
                await NotificationMetrics.increment("sent")
                return notif
            except Exception as e:
                logger.error(f"Error creating notification: {str(e)}")
                await session.rollback()
                raise

    @staticmethod
    async def process_and_fanout(
        user_id: str,
        type_: str,
        title: str,
        body: str,
        actor_id: str | None = None,
        payload_json: dict | None = None
    ):
        """High-performance fanout: checks preferences, filters quiet-hours, saves, and publishes to Redis Pub/Sub."""
        # Enforce privacy constraints: Check Block / Mute
        if actor_id:
            from app.core.privacy_service import PrivacyService
            # A block (either way) completely prevents notification delivery and websocket broadcasts
            if await PrivacyService.is_blocked(user_id, actor_id) or await PrivacyService.is_blocked(actor_id, user_id):
                logger.info(f"[PRIVACY ENFORCEMENT] Dropped notification: block active between user '{user_id}' and actor '{actor_id}'.")
                return

            # A mute suppresses active delivery (websocket broadcast) but still persists the database entry
            if await PrivacyService.is_muted(user_id, actor_id):
                logger.info(f"[PRIVACY ENFORCEMENT] Mute active: user '{user_id}' mutes actor '{actor_id}'. Suppressing delivery attempt.")
                notif = await NotificationService.create_notification(user_id, type_, title, body, actor_id, payload_json)
                async with AsyncSessionLocal() as session:
                    attempt = NotificationDeliveryAttempt(
                        notification_id=notif.id,
                        delivery_type="websocket",
                        status="failed",
                        error_message="Suppressed: Recipient has muted the actor"
                    )
                    session.add(attempt)
                    await session.commit()
                return

        # 1. Fetch user delivery preferences
        pref = await NotificationService.get_or_create_preferences(user_id)

        # 2. Check Quiet Hours suppression
        current_time_str = datetime.utcnow().strftime("%H:%M")
        if NotificationService.is_in_quiet_hours(pref.quiet_hours_start, pref.quiet_hours_end, current_time_str):
            logger.info(f"[SUPPRESSION] Notification to user '{user_id}' suppressed during quiet hours ({pref.quiet_hours_start} - {pref.quiet_hours_end}).")
            await NotificationMetrics.increment("suppressed")
            # Persist notification in database but mark attempt as suppressed
            notif = await NotificationService.create_notification(user_id, type_, title, body, actor_id, payload_json)
            async with AsyncSessionLocal() as session:
                attempt = NotificationDeliveryAttempt(
                    notification_id=notif.id,
                    delivery_type="websocket",
                    status="failed",
                    error_message="Suppressed: Quiet Hours active"
                )
                session.add(attempt)
                await session.commit()
            return

        # 3. Filter channels based on preferences
        if not pref.websocket_enabled:
            logger.info(f"[PREFERENCE BLOCK] WebSocket channel disabled for user '{user_id}'. Suppressing delivery.")
            await NotificationMetrics.increment("suppressed")
            await NotificationService.create_notification(user_id, type_, title, body, actor_id, payload_json)
            return

        # 4. Save notification and initial delivery attempt
        notif = await NotificationService.create_notification(user_id, type_, title, body, actor_id, payload_json)
        
        async with AsyncSessionLocal() as session:
            attempt = NotificationDeliveryAttempt(
                notification_id=notif.id,
                delivery_type="websocket",
                status="pending",
                retry_count=0
            )
            session.add(attempt)
            await session.commit()
            await session.refresh(attempt)
            attempt_id = attempt.id

        # 5. Broadcast via Redis Pub/Sub to target all active FastAPI nodes
        channel = f"user:{user_id}:notifications"
        event_payload = {
            "notification_id": notif.id,
            "delivery_attempt_id": attempt_id,
            "user_id": user_id,
            "type": type_,
            "title": title,
            "body": body,
            "actor_id": actor_id,
            "payload_json": payload_json,
            "is_read": False,
            "created_at": notif.created_at.isoformat()
        }
        
        logger.info(f"[FANOUT] Publishing notification to Redis Pub/Sub channel '{channel}'...")
        await redis_manager.publish_event(channel, event_payload)

    @staticmethod
    async def mark_delivery_success(attempt_id: int):
        """Mark a notification delivery attempt as successful in PostgreSQL."""
        async with AsyncSessionLocal() as session:
            try:
                query = update(NotificationDeliveryAttempt)\
                    .where(NotificationDeliveryAttempt.id == attempt_id)\
                    .values(status="success", delivered_at=datetime.utcnow())\
                    .execution_options(synchronize_session="fetch")
                await session.execute(query)
                await session.commit()
                await NotificationMetrics.increment("websocket_success")
                logger.info(f"[DELIVERY SUCCESS] Delivery attempt ID {attempt_id} updated successfully.")
            except Exception as e:
                logger.error(f"Failed to update delivery attempt {attempt_id}: {str(e)}")
                await session.rollback()

    @staticmethod
    async def run_retry_loop():
        """Background retry daemon task: polls pending attempts, triggers retry backoffs, and routes to DLQ."""
        logger.info("Background Notification Delivery Retry daemon initialized.")
        while True:
            try:
                await asyncio.sleep(10)
                async with AsyncSessionLocal() as session:
                    # Fetch all pending delivery attempts
                    query = select(NotificationDeliveryAttempt)\
                        .where(NotificationDeliveryAttempt.status == "pending")
                    res = await session.execute(query)
                    pending_attempts = res.scalars().all()

                    for attempt in pending_attempts:
                        # Fetch associated notification details
                        notif_query = select(Notification).where(Notification.id == attempt.notification_id)
                        notif_res = await session.execute(notif_query)
                        notif = notif_res.scalar_one_or_none()

                        if not notif:
                            continue

                        # Check retry cap limits (Dead-letter routing)
                        if attempt.retry_count >= MAX_RETRIES:
                            logger.error(f"[DLQ ROUTING] Delivery attempt {attempt.id} exceeded retry limit. Routing to Dead Letter Queue.")
                            attempt.status = "dlq"
                            attempt.error_message = "Retry cap exceeded. WebSocket client is permanently offline."
                            await NotificationMetrics.increment("failed")
                            continue

                        # Calculate exponential backoff interval
                        backoff_seconds = (2 ** attempt.retry_count) * 2  # 2s, 4s, 8s...
                        time_since_attempt = (datetime.utcnow() - attempt.notification.created_at).total_seconds()
                        if time_since_attempt < backoff_seconds:
                            # Too early to retry, respect the backoff delay
                            continue

                        # Increment retry count
                        attempt.retry_count += 1
                        await NotificationMetrics.increment("retries")
                        
                        logger.warn(f"[RETRY ENGINE] Retrying delivery attempt {attempt.id} for user '{notif.user_id}' (Retry {attempt.retry_count}/{MAX_RETRIES})")
                        
                        # Re-publish to Redis Pub/Sub to trigger all nodes
                        channel = f"user:{notif.user_id}:notifications"
                        event_payload = {
                            "notification_id": notif.id,
                            "delivery_attempt_id": attempt.id,
                            "user_id": notif.user_id,
                            "type": notif.type,
                            "title": notif.title,
                            "body": notif.body,
                            "actor_id": notif.actor_id,
                            "payload_json": json.loads(notif.payload_json) if notif.payload_json else None,
                            "is_read": notif.is_read,
                            "created_at": notif.created_at.isoformat()
                        }
                        await redis_manager.publish_event(channel, event_payload)
                        
                    await session.commit()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in Notification Delivery Retry loop: {str(e)}")
