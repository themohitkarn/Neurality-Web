import logging
from app.core.redis import redis_manager

logger = logging.getLogger("fastapi-app")

class PrivacyMetrics:
    @staticmethod
    async def increment(metric_name: str, amount: int = 1):
        """Increment a specific privacy graph metric counter in Redis."""
        if not redis_manager.client:
            return
        try:
            key = f"metrics:privacy:{metric_name}"
            await redis_manager.client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Failed to increment privacy metric {metric_name}: {str(e)}")

    @staticmethod
    async def get_counter(metric_name: str) -> int:
        """Get the value of a specific privacy graph counter metric from Redis."""
        if not redis_manager.client:
            return 0
        try:
            key = f"metrics:privacy:{metric_name}"
            val = await redis_manager.client.get(key)
            return int(val) if val else 0
        except Exception:
            return 0

    @staticmethod
    async def get_all_metrics() -> dict:
        """Get a snapshot of all privacy graph metrics."""
        return {
            "graph_cache_hits": await PrivacyMetrics.get_counter("cache_hit"),
            "graph_cache_misses": await PrivacyMetrics.get_counter("cache_miss"),
            "relationship_lookups": await PrivacyMetrics.get_counter("lookups"),
            "block_propagation_latency_sum_ms": await PrivacyMetrics.get_counter("block_propagation_latency"),
            "invalidation_counts": await PrivacyMetrics.get_counter("invalidation"),
            "websocket_graph_updates": await PrivacyMetrics.get_counter("websocket_updates")
        }
