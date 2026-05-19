import logging
from app.core.redis import redis_manager

logger = logging.getLogger("fastapi-app")

class FeatureMetrics:
    @staticmethod
    async def increment(metric_name: str, amount: int = 1):
        """Increment a specific feature flag metric counter in Redis."""
        if not redis_manager.client:
            return
        try:
            key = f"metrics:features:{metric_name}"
            await redis_manager.client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Failed to increment feature metric {metric_name}: {str(e)}")

    @staticmethod
    async def get_counter(metric_name: str) -> int:
        """Get the value of a specific feature flag counter metric from Redis."""
        if not redis_manager.client:
            return 0
        try:
            key = f"metrics:features:{metric_name}"
            val = await redis_manager.client.get(key)
            return int(val) if val else 0
        except Exception:
            return 0

    @staticmethod
    async def get_all_metrics() -> dict:
        """Get a snapshot of all feature flag and experimentation platform metrics."""
        return {
            "evaluations": await FeatureMetrics.get_counter("feature_evaluations"),
            "cache_hits": await FeatureMetrics.get_counter("feature_cache_hits"),
            "cache_misses": await FeatureMetrics.get_counter("feature_cache_misses"),
            "rollout_assignments": await FeatureMetrics.get_counter("rollout_assignment_counts"),
            "kill_switch_activations": await FeatureMetrics.get_counter("kill_switch_activations"),
            "propagation_latency_sum_ms": await FeatureMetrics.get_counter("propagation_latency_sum_ms")
        }
