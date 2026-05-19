import json
import logging
import time
from extensions import redis_client

logger = logging.getLogger("neurality.redis")

class RedisService:
    _local_cache = {}          # Key -> (expire_timestamp, serialized_value)
    _local_spam_counters = {}  # Key -> [(timestamp, count)]
    _redis_active = None       # Tri-state: None (untested), True (active), False (inactive/fallback)

    @classmethod
    def is_active(cls):
        """Check if Redis connection is active, with lazy evaluation and validation."""
        if cls._redis_active is not None:
            return cls._redis_active

        if redis_client is None:
            cls._redis_active = False
            logger.warning("[REDIS] Redis client not configured. Falling back to local memory storage.")
            return False

        try:
            # Quick ping test to confirm active server
            redis_client.ping()
            cls._redis_active = True
            logger.info("[REDIS] Successfully connected to high-performance Redis cache.")
        except Exception as e:
            cls._redis_active = False
            logger.error(f"[REDIS] Connection failed: {e}. Gracefully falling back to local memory storage.")
        
        return cls._redis_active

    @classmethod
    def set(cls, key, value, ttl=None):
        """Set a key value pair in Redis with optional TTL (falls back to local memory)."""
        now = time.time()
        serialized = json.dumps(value)
        
        if cls.is_active():
            try:
                if ttl:
                    redis_client.setex(key, int(ttl), serialized)
                else:
                    redis_client.set(key, serialized)
                return True
            except Exception as e:
                logger.error(f"[REDIS] Write failed for {key}: {e}. Storing in local backup.")
                # Keep active status True, but handle local fallback
        
        # Local Backup Fallback
        expire_time = now + ttl if ttl else None
        cls._local_cache[key] = (expire_time, serialized)
        return True

    @classmethod
    def get(cls, key):
        """Get a value by key (checks Redis first, falls back to local memory)."""
        now = time.time()
        
        if cls.is_active():
            try:
                data = redis_client.get(key)
                if data is not None:
                    return json.loads(data)
                return None
            except Exception as e:
                logger.error(f"[REDIS] Read failed for {key}: {e}. Checking local backup.")
        
        # Local Backup Fallback
        if key in cls._local_cache:
            expire_time, serialized = cls._local_cache[key]
            if expire_time is None or now < expire_time:
                return json.loads(serialized)
            else:
                # Key expired
                del cls._local_cache[key]
        
        return None

    @classmethod
    def delete(cls, key):
        """Delete a key (supports local fallback)."""
        deleted = False
        if cls.is_active():
            try:
                redis_client.delete(key)
                deleted = True
            except Exception as e:
                logger.error(f"[REDIS] Delete failed for {key}: {e}")
        
        if key in cls._local_cache:
            del cls._local_cache[key]
            deleted = True
            
        return deleted

    @classmethod
    def increment_spam_counter(cls, user_id, action_type, window_seconds=60):
        """
        Increment a sliding window spam counter for a user action.
        Returns the active count within the window_seconds interval.
        """
        now = time.time()
        key = f"neurality:spam:{action_type}:{user_id}"
        
        if cls.is_active():
            try:
                # Using Redis pipeline for lightning-fast atomic operations
                pipe = redis_client.pipeline()
                # 1. Add current timestamp to sorted set (unique score/member)
                pipe.zadd(key, {f"{now}:{time.thread_time_ns()}": now})
                # 2. Clear old timestamps out of window
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                # 3. Get total count within the window
                pipe.zcard(key)
                # 4. Set TTL on key to auto-expire idle spammers
                pipe.expire(key, window_seconds + 10)
                
                results = pipe.execute()
                active_count = results[2]
                return active_count
            except Exception as e:
                logger.error(f"[REDIS] Spam counter failed for {key}: {e}. Checking local backup.")

        # Local sliding window fallback
        if key not in cls._local_spam_counters:
            cls._local_spam_counters[key] = []
            
        # Clean local old logs
        cls._local_spam_counters[key] = [t for t in cls._local_spam_counters[key] if now - t < window_seconds]
        # Append current action
        cls._local_spam_counters[key].append(now)
        return len(cls._local_spam_counters[key])

    @classmethod
    def get_spam_count(cls, user_id, action_type, window_seconds=60):
        """Get the current count of actions within the window without incrementing."""
        now = time.time()
        key = f"neurality:spam:{action_type}:{user_id}"
        
        if cls.is_active():
            try:
                # Get elements in the time window
                redis_client.zremrangebyscore(key, 0, now - window_seconds)
                return redis_client.zcard(key)
            except Exception as e:
                logger.error(f"[REDIS] Spam count query failed for {key}: {e}")

        # Local fallback
        if key in cls._local_spam_counters:
            cls._local_spam_counters[key] = [t for t in cls._local_spam_counters[key] if now - t < window_seconds]
            return len(cls._local_spam_counters[key])
        return 0
