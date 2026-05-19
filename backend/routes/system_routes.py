import time
from flask import Blueprint, jsonify
from utils.redis_service import RedisService
from ml.recommender import RecommenderCache
from extensions import redis_client

system_bp = Blueprint("system", __name__)

@system_bp.get("/cache-health")
def get_cache_health():
    fallback_active = not RedisService.is_active()
    ping_latency_ms = -1
    active_connections = 0
    used_memory = "N/A"
    uptime = 0

    if not fallback_active:
        try:
            # Measure ping latency
            t0 = time.perf_counter()
            redis_client.ping()
            ping_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            
            # Query server info stats
            info = redis_client.info()
            active_connections = info.get("connected_clients", 0)
            used_memory = info.get("used_memory_human", "N/A")
            uptime = info.get("uptime_in_seconds", 0)
        except Exception:
            fallback_active = True

    hit_ratio = round(RecommenderCache.get_hit_ratio(), 4)

    return jsonify({
        "status": "healthy" if not fallback_active else "degraded",
        "fallback_mode_active": fallback_active,
        "ping_latency_ms": ping_latency_ms,
        "active_connections": active_connections,
        "used_memory": used_memory,
        "uptime_seconds": uptime,
        "recommendation_cache": {
            "hits": RecommenderCache._hits,
            "misses": RecommenderCache._misses,
            "hit_ratio": hit_ratio
        }
    }),200
