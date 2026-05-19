import logging
import json
import time
from datetime import datetime
from sqlalchemy import select, delete, and_
from app.core.db import AsyncSessionLocal
from app.models.privacy import UserEdge
from app.core.redis import redis_manager
from app.core.kafka import kafka_manager
from app.core.privacy_metrics import PrivacyMetrics

logger = logging.getLogger("fastapi-app")

VALID_EDGE_TYPES = {"blocked", "muted", "restricted", "close_friend", "favorite"}

class PrivacyService:
    @staticmethod
    def _cache_key(user_id: str, edge_type: str) -> str:
        return f"graph:{user_id}:{edge_type}"

    @staticmethod
    async def get_or_hydrate_cache(source_id: str, edge_type: str) -> set[str]:
        """Fetch target user IDs for a source user and edge type, with Redis-first caching."""
        if edge_type not in VALID_EDGE_TYPES:
            return set()

        key = PrivacyService._cache_key(source_id, edge_type)
        
        # 1. Try fetching from Redis
        if redis_manager.client:
            try:
                exists = await redis_manager.client.exists(key)
                if exists:
                    members = await redis_manager.client.smembers(key)
                    await PrivacyMetrics.increment("cache_hit")
                    # Exclude the empty sentinel
                    return {m for m in members if m != "__EMPTY__"}
            except Exception as e:
                logger.error(f"Redis error in get_or_hydrate_cache: {str(e)}")

        # 2. Cache miss: Fetch from PostgreSQL
        await PrivacyMetrics.increment("cache_miss")
        target_ids = []
        try:
            async with AsyncSessionLocal() as session:
                query = select(UserEdge.target_user_id).where(
                    and_(UserEdge.source_user_id == str(source_id), UserEdge.edge_type == edge_type)
                )
                res = await session.execute(query)
                target_ids = [str(r) for r in res.scalars().all()]
        except Exception as e:
            logger.error(f"Database lookup failed in get_or_hydrate_cache: {str(e)}")
            return set()

        # 3. Hydrate Redis with a TTL of 24h (86400s)
        if redis_manager.client:
            try:
                # Use transactional pipeline or simple delete-then-add to hydrate cleanly
                await redis_manager.client.delete(key)
                if target_ids:
                    await redis_manager.client.sadd(key, *target_ids)
                else:
                    await redis_manager.client.sadd(key, "__EMPTY__")
                await redis_manager.client.expire(key, 86400)
            except Exception as e:
                logger.error(f"Redis hydration failed in get_or_hydrate_cache: {str(e)}")

        return set(target_ids)

    @staticmethod
    async def invalidate_cache(source_id: str, edge_type: str):
        """Invalidate the Redis cache for the given user relationship edge."""
        key = PrivacyService._cache_key(source_id, edge_type)
        if redis_manager.client:
            try:
                await redis_manager.client.delete(key)
                await PrivacyMetrics.increment("invalidation")
                logger.info(f"[GRAPH INVALIDATION] Cache invalidated for key: {key}")
            except Exception as e:
                logger.error(f"Failed to invalidate cache key {key}: {str(e)}")

    # --- Query Engine Helpers ---
    @staticmethod
    async def is_blocked(source_id: str, target_id: str) -> bool:
        """Check if source_id blocks target_id."""
        await PrivacyMetrics.increment("lookups")
        blocked_set = await PrivacyService.get_or_hydrate_cache(source_id, "blocked")
        return str(target_id) in blocked_set

    @staticmethod
    async def is_muted(source_id: str, target_id: str) -> bool:
        """Check if source_id mutes target_id."""
        await PrivacyMetrics.increment("lookups")
        muted_set = await PrivacyService.get_or_hydrate_cache(source_id, "muted")
        return str(target_id) in muted_set

    @staticmethod
    async def is_restricted(source_id: str, target_id: str) -> bool:
        """Check if source_id restricts target_id."""
        await PrivacyMetrics.increment("lookups")
        restricted_set = await PrivacyService.get_or_hydrate_cache(source_id, "restricted")
        return str(target_id) in restricted_set

    @staticmethod
    async def is_close_friend(source_id: str, target_id: str) -> bool:
        """Check if source_id marks target_id as close_friend."""
        await PrivacyMetrics.increment("lookups")
        cf_set = await PrivacyService.get_or_hydrate_cache(source_id, "close_friend")
        return str(target_id) in cf_set

    @staticmethod
    async def is_favorite(source_id: str, target_id: str) -> bool:
        """Check if source_id marks target_id as favorite."""
        await PrivacyMetrics.increment("lookups")
        fav_set = await PrivacyService.get_or_hydrate_cache(source_id, "favorite")
        return str(target_id) in fav_set

    @staticmethod
    async def get_relationship(source_id: str, target_id: str) -> dict:
        """Get full composite relationship snapshot between two users."""
        source_str = str(source_id)
        target_str = str(target_id)
        return {
            "is_blocked": await PrivacyService.is_blocked(source_str, target_str),
            "is_blocked_by": await PrivacyService.is_blocked(target_str, source_str),
            "is_muted": await PrivacyService.is_muted(source_str, target_str),
            "is_restricted": await PrivacyService.is_restricted(source_str, target_str),
            "is_close_friend": await PrivacyService.is_close_friend(source_str, target_str),
            "is_favorite": await PrivacyService.is_favorite(source_str, target_str)
        }

    # --- Mutation Helpers ---
    @staticmethod
    async def add_edge(source_id: str, target_id: str, edge_type: str) -> UserEdge:
        """Create or update a relationship edge in PostgreSQL, propagate updates, and invalidate caches."""
        if edge_type not in VALID_EDGE_TYPES:
            raise ValueError(f"Invalid edge type: {edge_type}")

        source_str = str(source_id)
        target_str = str(target_id)
        if source_str == target_str:
            raise ValueError("Users cannot create relationship edges to themselves.")

        # 1. Save to PostgreSQL
        async with AsyncSessionLocal() as session:
            try:
                # Check for duplicate
                query = select(UserEdge).where(
                    and_(
                        UserEdge.source_user_id == source_str,
                        UserEdge.target_user_id == target_str,
                        UserEdge.edge_type == edge_type
                    )
                )
                res = await session.execute(query)
                edge = res.scalar_one_or_none()

                if not edge:
                    edge = UserEdge(
                        source_user_id=source_str,
                        target_user_id=target_str,
                        edge_type=edge_type
                    )
                    session.add(edge)
                    await session.commit()
                    await session.refresh(edge)
                else:
                    edge.updated_at = datetime.utcnow()
                    await session.commit()
                    await session.refresh(edge)
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to persist edge: {str(e)}")
                raise

        # 2. Invalidate Cache
        await PrivacyService.invalidate_cache(source_str, edge_type)

        # If it is a block, invalidate the reverse/blocked_by lookups cache too
        if edge_type == "blocked":
            await PrivacyService.invalidate_cache(target_str, "blocked")

        # 3. Propagate Kafka Event
        try:
            start_prop = time.perf_counter()
            payload = {
                "source_user_id": source_str,
                "target_user_id": target_str,
                "edge_type": edge_type,
                "action": "create",
                "timestamp": datetime.utcnow().isoformat()
            }
            await kafka_manager.send_event(
                key=source_str,
                value=json.dumps(payload),
                topic="graph.edge.updated"
            )
            
            # Trace block propagation latency metric
            latency_ms = int((time.perf_counter() - start_prop) * 1000)
            if edge_type == "blocked":
                await PrivacyMetrics.increment("block_propagation_latency", latency_ms)
        except Exception as e:
            logger.error(f"Failed to publish Kafka graph event: {str(e)}")

        # 4. Propagate Realtime Redis Pub/Sub Graph Event to active WS nodes
        if redis_manager.client:
            try:
                pub_payload = {
                    "event": "user.relationship.updated",
                    "source_id": source_str,
                    "target_id": target_str,
                    "edge_type": edge_type,
                    "action": "create",
                    "timestamp": datetime.utcnow().isoformat()
                }
                # Publish to both user channels so both target and source get the websocket updates
                await redis_manager.publish_event(f"user:{source_str}:graph", pub_payload)
                await redis_manager.publish_event(f"user:{target_str}:graph", pub_payload)
                await PrivacyMetrics.increment("websocket_updates")
            except Exception as e:
                logger.error(f"Failed to publish Redis Pub/Sub graph event: {str(e)}")

        return edge

    @staticmethod
    async def remove_edge(source_id: str, target_id: str, edge_type: str) -> bool:
        """Remove a relationship edge in PostgreSQL, propagate updates, and invalidate caches."""
        if edge_type not in VALID_EDGE_TYPES:
            raise ValueError(f"Invalid edge type: {edge_type}")

        source_str = str(source_id)
        target_str = str(target_id)

        # 1. Delete from PostgreSQL
        deleted = False
        async with AsyncSessionLocal() as session:
            try:
                query = delete(UserEdge).where(
                    and_(
                        UserEdge.source_user_id == source_str,
                        UserEdge.target_user_id == target_str,
                        UserEdge.edge_type == edge_type
                    )
                )
                res = await session.execute(query)
                await session.commit()
                if res.rowcount > 0:
                    deleted = True
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to delete edge: {str(e)}")
                raise

        if not deleted:
            return False

        # 2. Invalidate Cache
        await PrivacyService.invalidate_cache(source_str, edge_type)

        if edge_type == "blocked":
            await PrivacyService.invalidate_cache(target_str, "blocked")

        # 3. Propagate Kafka Event
        try:
            payload = {
                "source_user_id": source_str,
                "target_user_id": target_str,
                "edge_type": edge_type,
                "action": "delete",
                "timestamp": datetime.utcnow().isoformat()
            }
            await kafka_manager.send_event(
                key=source_str,
                value=json.dumps(payload),
                topic="graph.edge.updated"
            )
        except Exception as e:
            logger.error(f"Failed to publish Kafka graph event: {str(e)}")

        # 4. Propagate Realtime Redis Pub/Sub Graph Event to active WS nodes
        if redis_manager.client:
            try:
                pub_payload = {
                    "event": "user.relationship.updated",
                    "source_id": source_str,
                    "target_id": target_str,
                    "edge_type": edge_type,
                    "action": "delete",
                    "timestamp": datetime.utcnow().isoformat()
                }
                await redis_manager.publish_event(f"user:{source_str}:graph", pub_payload)
                await redis_manager.publish_event(f"user:{target_str}:graph", pub_payload)
                await PrivacyMetrics.increment("websocket_updates")
            except Exception as e:
                logger.error(f"Failed to publish Redis Pub/Sub graph event: {str(e)}")

        return True

    @staticmethod
    async def get_edges(source_id: str, edge_type: str) -> list[str]:
        """Retrieve all target user IDs for a specific user and edge type."""
        target_ids = await PrivacyService.get_or_hydrate_cache(source_id, edge_type)
        return list(target_ids)
