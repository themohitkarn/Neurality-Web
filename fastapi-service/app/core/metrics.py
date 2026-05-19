import logging
from app.core.redis import redis_manager
from sqlalchemy import select, func
from app.models.notification import Notification
from app.core.db import AsyncSessionLocal

logger = logging.getLogger("fastapi-app")

class NotificationMetrics:
    @staticmethod
    async def increment(metric_name: str, amount: int = 1):
        """Increment a specific notification metric counter in Redis."""
        if not redis_manager.client:
            return
        try:
            key = f"metrics:notifications:{metric_name}"
            await redis_manager.client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Failed to increment metric {metric_name}: {str(e)}")

    @staticmethod
    async def get_counter(metric_name: str) -> int:
        """Get the value of a specific counter metric from Redis."""
        if not redis_manager.client:
            return 0
        try:
            key = f"metrics:notifications:{metric_name}"
            val = await redis_manager.client.get(key)
            return int(val) if val else 0
        except Exception:
            return 0

    @staticmethod
    async def get_unread_count_db() -> int:
        """Fetch total unread notifications count from PostgreSQL."""
        try:
            async with AsyncSessionLocal() as session:
                query = select(func.count()).select_from(Notification).where(Notification.is_read == False)
                res = await session.execute(query)
                return res.scalar() or 0
        except Exception as e:
            logger.error(f"Failed to fetch total unread notifications from DB: {str(e)}")
            return 0

    @staticmethod
    async def get_all_metrics() -> dict:
        """Get a snapshot dictionary of all notification-related metrics."""
        return {
            "notifications_sent": await NotificationMetrics.get_counter("sent"),
            "websocket_deliveries": await NotificationMetrics.get_counter("websocket_success"),
            "failed_deliveries": await NotificationMetrics.get_counter("failed"),
            "retries": await NotificationMetrics.get_counter("retries"),
            "suppression_counts": await NotificationMetrics.get_counter("suppressed"),
            "unread_counts": await NotificationMetrics.get_unread_count_db()
        }
