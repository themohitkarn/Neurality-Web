import logging
import redis.asyncio as aioredis
from app.config import settings
import asyncio
import json
import time

logger = logging.getLogger("fastapi-app")

# ====================================================
# PART 8 — CLUSTER OBSERVABILITY METRICS
# ====================================================
PUB_SUB_LATENCY_SUM = 0.0
PUB_SUB_EVENTS_COUNT = 0
SUBSCRIBER_RECONNECTS = 0
CROSS_INSTANCE_BROADCASTS = 0
LOCAL_FANOUT_COUNTS = 0
DROPPED_DELIVERIES = 0

class RedisManager:
    def __init__(self):
        self.client: aioredis.Redis | None = None

    async def connect(self):
        """Establish asynchronous Redis connection pool."""
        logger.info(f"Connecting to Redis at {settings.REDIS_URL}...")
        self.client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await self.client.ping()
        logger.info("Redis connection successfully established.")

    async def disconnect(self):
        """Cleanly close connection pool."""
        if self.client:
            logger.info("Disconnecting from Redis...")
            await self.client.close()
            logger.info("Redis connection closed.")

    async def get_json(self, key: str) -> dict | None:
        """Asynchronously fetch and parse JSON from Redis."""
        if not self.client:
            return None
        try:
            data = await self.client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Redis get_json error for key {key}: {str(e)}")
        return None

    async def set_json(self, key: str, value: dict, ttl: int = 86400):
        """Asynchronously serialize and store JSON in Redis with a custom TTL."""
        if not self.client:
            return
        try:
            await self.client.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            logger.error(f"Redis set_json error for key {key}: {str(e)}")

    async def delete(self, key: str):
        """Asynchronously evict/delete a key from Redis."""
        if not self.client:
            return
        try:
            await self.client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error for key {key}: {str(e)}")

    # ====================================================
    # PART 5 & 7 — RESILIENT REDIS EVENT PUBLISHER
    # ====================================================
    async def publish_event(self, channel: str, message: dict) -> bool:
        """Publish JSON event to Redis Pub/Sub channel with built-in retry logic."""
        if not self.client:
            logger.error("Redis client not connected. Failed to publish event.")
            return False

        payload = json.dumps(message)
        
        # Publish retry logic
        for attempt in range(3):
            try:
                start_time = time.perf_counter()
                await self.client.publish(channel, payload)
                latency = (time.perf_counter() - start_time) * 1000
                logger.info(f"Published settings update to Redis channel '{channel}' in {latency:.2f} ms")
                return True
            except Exception as e:
                logger.warning(f"Redis publish attempt {attempt+1} failed: {str(e)}. Retrying...")
                await asyncio.sleep(0.2)

        logger.error(f"Redis publish permanently failed for channel {channel}")
        return False

# Standard singleton instantiation
redis_manager = RedisManager()

# ====================================================
# PART 2, 4 & 7 — RESILIENT REDIS SUBSCRIBER WORKER
# ====================================================
async def redis_pubsub_subscriber_loop():
    """Wildcard subscription loop. Handles settings and notifications routing with database feedback."""
    global SUBSCRIBER_RECONNECTS, CROSS_INSTANCE_BROADCASTS, LOCAL_FANOUT_COUNTS, DROPPED_DELIVERIES, PUB_SUB_LATENCY_SUM, PUB_SUB_EVENTS_COUNT
    
    from app.core.websocket import ws_manager
    
    logger.info("Initializing Redis Pub/Sub Wildcard Subscriber background task...")
    
    while True:
        try:
            # Dedicated client to avoid blocking the primary pool connection
            sub_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = sub_client.pubsub()
            
            # Wildcard subscription matching user:*:settings, user:*:notifications, user:*:graph, and features:updates
            await pubsub.psubscribe("user:*:settings", "user:*:notifications", "user:*:graph", "features:updates")
            logger.info("Redis Pub/Sub wildcard subscribed successfully to user and features topics")
            
            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    data_str = message["data"]
                    
                    try:
                        data = json.loads(data_str)
                        user_id = data.get("user_id")
                        
                        # Trace Pub/Sub Delivery Latency
                        if "updated_at" in data or "created_at" in data:
                            try:
                                from datetime import datetime
                                ts_str = data.get("updated_at") or data.get("created_at")
                                event_time = datetime.fromisoformat(ts_str)
                                latency = (datetime.utcnow() - event_time).total_seconds() * 1000
                                if latency > 0:
                                    PUB_SUB_LATENCY_SUM += latency
                                    PUB_SUB_EVENTS_COUNT += 1
                                    logger.info(f"[OBSERVABILITY] Event latency: {latency:.2f} ms")
                            except Exception:
                                pass
                        
                        CROSS_INSTANCE_BROADCASTS += 1
                        
                        if "features:updates" in channel:
                            # Route Feature Flag propagation events to ALL locally connected WebSocket users
                            logger.info(f"[PUB/SUB MATCH] Routing global feature flag update cluster-wide...")
                            for uid in list(ws_manager.active_connections.keys()):
                                count = await ws_manager.broadcast_local(uid, {
                                    "event": "feature.updated",
                                    "payload": data
                                })
                                LOCAL_FANOUT_COUNTS += count
                        elif "notifications" in channel:
                            # 1. Route Notification Events
                            if ws_manager.has_connections(str(user_id)):
                                logger.info(f"[PUB/SUB MATCH] Routing local socket notification for user '{user_id}'...")
                                count = await ws_manager.broadcast_local(str(user_id), {
                                    "event": "user.notification.created",
                                    "payload": data
                                })
                                LOCAL_FANOUT_COUNTS += count
                                
                                # Mark attempt success in DB upon successful broadcast delivery
                                attempt_id = data.get("delivery_attempt_id")
                                if attempt_id and count > 0:
                                    from app.core.notification_service import NotificationService
                                    await NotificationService.mark_delivery_success(attempt_id)
                            else:
                                DROPPED_DELIVERIES += 1
                                logger.debug(f"[PUB/SUB DROP] No local sockets for user '{user_id}'. Ignored.")
                        elif "graph" in channel:
                            # 2. Route Graph/Relationship Events
                            # Parse user ID from channel name 'user:{user_id}:graph'
                            import re
                            match = re.match(r"user:([^:]+):graph", channel)
                            if match:
                                target_user_id = match.group(1)
                                if ws_manager.has_connections(target_user_id):
                                    logger.info(f"[PUB/SUB MATCH] Routing local socket graph update for user '{target_user_id}'...")
                                    count = await ws_manager.broadcast_local(target_user_id, data)
                                    LOCAL_FANOUT_COUNTS += count
                                else:
                                    logger.debug(f"[PUB/SUB DROP] No local sockets for user '{target_user_id}'. Ignored.")
                        else:
                            # 3. Route Settings Updates
                            if ws_manager.has_connections(str(user_id)):
                                logger.info(f"[PUB/SUB MATCH] Routing local socket settings broadcast for user '{user_id}'...")
                                count = await ws_manager.broadcast_local(str(user_id), {
                                    "event": "user.setting.updated",
                                    "payload": data
                                })
                                LOCAL_FANOUT_COUNTS += count
                            else:
                                DROPPED_DELIVERIES += 1
                                logger.debug(f"[PUB/SUB DROP] No local sockets for user '{user_id}'. Ignored.")
                    except Exception as e:
                        logger.error(f"Error decoding Redis Pub/Sub message: {str(e)}")
                        
        except asyncio.CancelledError:
            logger.info("Redis Pub/Sub subscriber worker cancelled.")
            break
        except Exception as e:
            SUBSCRIBER_RECONNECTS += 1
            logger.error(f"Redis Pub/Sub connection lost: {str(e)}. Reconnecting in 3 seconds...")
            await asyncio.sleep(3)

