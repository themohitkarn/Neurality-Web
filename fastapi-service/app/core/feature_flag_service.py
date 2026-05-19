import logging
import json
import hashlib
import time
from datetime import datetime
from sqlalchemy import select, delete, update, and_
from app.core.db import AsyncSessionLocal
from app.models.feature_flag import FeatureFlag, FeatureFlagRule, ExperimentAssignment
from app.core.redis import redis_manager
from app.core.kafka import kafka_manager
from app.core.feature_metrics import FeatureMetrics

logger = logging.getLogger("fastapi-app")

class FeatureFlagService:
    @staticmethod
    def _cache_key(feature_name: str) -> str:
        return f"feature:{feature_name}"

    @staticmethod
    async def get_or_hydrate_flag(feature_name: str) -> dict | None:
        """Fetch feature flag configuration with Redis-first caching and automatic database hydration."""
        key = FeatureFlagService._cache_key(feature_name)
        
        # 1. Try Redis cache lookup
        if redis_manager.client:
            try:
                cached = await redis_manager.client.get(key)
                if cached:
                    await FeatureMetrics.increment("feature_cache_hits")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis lookup error for feature {feature_name}: {str(e)}")

        # 2. Cache miss: Fetch from PostgreSQL
        await FeatureMetrics.increment("feature_cache_misses")
        try:
            async with AsyncSessionLocal() as session:
                query = select(FeatureFlag).where(FeatureFlag.feature_name == feature_name)
                res = await session.execute(query)
                flag = res.scalar_one_or_none()
                
                if not flag:
                    return None

                # Construct JSON-serializable dictionary representing flag & rules
                flag_data = {
                    "id": flag.id,
                    "feature_name": flag.feature_name,
                    "enabled": flag.enabled,
                    "rollout_percentage": flag.rollout_percentage,
                    "config_json": flag.config_json,
                    "rules": [{"rule_type": r.rule_type, "rule_value": r.rule_value} for r in flag.rules],
                    "created_at": flag.created_at.isoformat() if flag.created_at else datetime.utcnow().isoformat(),
                    "updated_at": flag.updated_at.isoformat() if flag.updated_at else datetime.utcnow().isoformat()
                }
        except Exception as e:
            logger.error(f"Database lookup failed for feature {feature_name}: {str(e)}")
            return None

        # 3. Hydrate Redis with a TTL of 24 hours (86400s)
        if redis_manager.client:
            try:
                await redis_manager.client.set(key, json.dumps(flag_data), ex=86400)
            except Exception as e:
                logger.error(f"Failed to hydrate Redis cache for {feature_name}: {str(e)}")

        return flag_data

    @staticmethod
    async def invalidate_cache(feature_name: str):
        """Evict a feature flag from the Redis cache."""
        key = FeatureFlagService._cache_key(feature_name)
        if redis_manager.client:
            try:
                await redis_manager.client.delete(key)
                logger.info(f"[FEATURE CACHE INVALIDATION] Evicted cache key: {key}")
            except Exception as e:
                logger.error(f"Failed to evict cache key {key}: {str(e)}")

    @staticmethod
    def get_bucket(user_id: str, feature_name: str) -> int:
        """Deterministically bucket a user into a stable percentage range (0-99)."""
        key = f"{user_id}:{feature_name}".encode("utf-8")
        hash_hex = hashlib.sha256(key).hexdigest()
        return int(hash_hex, 16) % 100

    @staticmethod
    def get_variant_bucket(user_id: str, feature_name: str, num_variants: int) -> int:
        """Deterministically bucket a qualified user into an experimentation variant index."""
        key = f"{user_id}:{feature_name}:variant".encode("utf-8")
        hash_hex = hashlib.sha256(key).hexdigest()
        return int(hash_hex, 16) % num_variants

    @staticmethod
    async def get_user_context(user_id: str) -> dict:
        """Fetch targeted properties dynamically for a user from their settings and account details."""
        context = {"region": "US", "beta_cohort": False}
        try:
            from app.models.user_settings import UserSettings
            from app.models.user import User

            async with AsyncSessionLocal() as session:
                # 1. Check User Settings
                settings_q = select(UserSettings).where(UserSettings.user_id == str(user_id))
                settings_res = await session.execute(settings_q)
                settings = settings_res.scalar_one_or_none()
                if settings:
                    context["region"] = settings.language.upper()
                    if settings.theme == "beta":
                        context["beta_cohort"] = True

                # 2. Check User profile/username constraints (e.g. beta group test accounts)
                user_q = select(User).where(User.username == user_id)
                user_res = await session.execute(user_q)
                user = user_res.scalar_one_or_none()
                
                # Alternate lookup by numeric ID if user_id is a DB primary key string
                if not user and str(user_id).isdigit():
                    user_q = select(User).where(User.id == int(user_id))
                    user_res = await session.execute(user_q)
                    user = user_res.scalar_one_or_none()

                if user:
                    if "beta" in user.username.lower() or "test" in user.username.lower():
                        context["beta_cohort"] = True
                    if "beta" in user.email.lower() or "test" in user.email.lower():
                        context["beta_cohort"] = True
        except Exception as e:
            logger.warning(f"Failed to load user context for {user_id}: {str(e)}")
        return context

    @staticmethod
    async def evaluate_feature(user_id: str, feature_name: str, context: dict = None) -> dict:
        """
        Evaluate a feature flag's state for a given user.
        Returns:
            dict: {"enabled": bool, "variant": str, "config": dict}
        """
        await FeatureMetrics.increment("feature_evaluations")
        
        # Load user context if none is provided
        if context is None:
            context = await FeatureFlagService.get_user_context(user_id)

        # 1. Fetch feature configuration
        flag = await FeatureFlagService.get_or_hydrate_flag(feature_name)
        if not flag:
            return {"enabled": False, "variant": "control", "config": {}}

        # 2. Kill Switch / Enabled enforcement
        if not flag["enabled"]:
            await FeatureMetrics.increment("kill_switch_activations")
            return {"enabled": False, "variant": "control", "config": {}}

        # Parse config JSON
        parsed_config = {}
        if flag["config_json"]:
            try:
                parsed_config = json.loads(flag["config_json"])
            except Exception:
                pass

        # 3. Target Rules Evaluation
        rules = flag["rules"]
        bypass_rollout = False
        if rules:
            has_whitelist_rule = False
            whitelist_matched = False
            
            has_targeting_rule = False
            targeting_matched = False
            
            for rule in rules:
                rtype = rule["rule_type"].lower()
                rval = rule["rule_value"]
                
                if rtype == "user_id":
                    has_whitelist_rule = True
                    whitelisted_ids = [i.strip() for i in rval.split(",")]
                    if str(user_id) in whitelisted_ids:
                        whitelist_matched = True
                        
                elif rtype in ("region", "language"):
                    has_targeting_rule = True
                    user_region = str(context.get("region", "")).lower()
                    if user_region == rval.lower():
                        targeting_matched = True
                        
                elif rtype == "beta_cohort":
                    has_targeting_rule = True
                    is_beta = context.get("beta_cohort", False)
                    # Evaluate boolean state
                    if str(is_beta).lower() == "true" or is_beta is True:
                        if rval.lower() in ("true", "1", "yes"):
                            targeting_matched = True

            # If user_id whitelist exists, it overrides standard rollout
            if has_whitelist_rule and whitelist_matched:
                bypass_rollout = True
            # Otherwise, if targeting filter exists and user doesn't qualify, reject
            elif has_targeting_rule and not targeting_matched:
                return {"enabled": False, "variant": "control", "config": {}}

        # 4. Percentage Rollout Deterministic Bucketing
        if not bypass_rollout:
            bucket = FeatureFlagService.get_bucket(user_id, feature_name)
            if bucket >= flag["rollout_percentage"]:
                # User is not part of this rollout batch
                return {"enabled": False, "variant": "control", "config": {}}

        # 5. Experimentation Variant Assignments (Sticky & Deterministic)
        variants = parsed_config.get("variants")
        if isinstance(variants, list) and len(variants) > 0:
            # First, check if sticky assignment exists in database
            sticky_assignment = None
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(ExperimentAssignment).where(
                        and_(
                            ExperimentAssignment.user_id == str(user_id),
                            ExperimentAssignment.feature_name == feature_name
                        )
                    )
                    res = await session.execute(stmt)
                    sticky_assignment = res.scalar_one_or_none()
            except Exception as e:
                logger.error(f"Error querying sticky experiment assignment: {str(e)}")

            if sticky_assignment:
                return {
                    "enabled": True,
                    "variant": sticky_assignment.variant,
                    "config": parsed_config
                }

            # Else: Assign new variant deterministically and persist
            var_idx = FeatureFlagService.get_variant_bucket(user_id, feature_name, len(variants))
            assigned_variant = variants[var_idx]

            try:
                async with AsyncSessionLocal() as session:
                    new_assign = ExperimentAssignment(
                        user_id=str(user_id),
                        feature_name=feature_name,
                        variant=assigned_variant
                    )
                    session.add(new_assign)
                    await session.commit()
                    await FeatureMetrics.increment("rollout_assignment_counts")
                    logger.info(f"[EXPERIMENT ASSIGN] User '{user_id}' assigned to variant '{assigned_variant}' for '{feature_name}'.")
            except Exception as e:
                logger.error(f"Failed to record sticky variant assignment: {str(e)}")

            return {
                "enabled": True,
                "variant": assigned_variant,
                "config": parsed_config
            }

        # Otherwise: standard feature rollout
        return {"enabled": True, "variant": "control", "config": parsed_config}

    # --- Mutations and Config Propagation ---

    @staticmethod
    async def create_flag(
        feature_name: str,
        enabled: bool,
        rollout_percentage: int,
        config_json: str = None,
        rules: list[dict] = None
    ) -> dict:
        """Create a new Feature Flag along with optional targeting rules, and propagate changes."""
        async with AsyncSessionLocal() as session:
            try:
                # 1. Create Feature Flag record
                flag = FeatureFlag(
                    feature_name=feature_name,
                    enabled=enabled,
                    rollout_percentage=rollout_percentage,
                    config_json=config_json
                )
                session.add(flag)
                await session.flush()  # Populates flag.id

                # 2. Add Targeting Rules
                if rules:
                    for rule in rules:
                        r = FeatureFlagRule(
                            feature_flag_id=flag.id,
                            rule_type=rule["rule_type"],
                            rule_value=rule["rule_value"]
                        )
                        session.add(r)
                
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to create feature flag '{feature_name}': {str(e)}")
                raise

        # 3. Invalidate Redis cache
        await FeatureFlagService.invalidate_cache(feature_name)

        # 4. Propagate Realtime Updates
        await FeatureFlagService.propagate_config_updates(feature_name, enabled, rollout_percentage)

        return await FeatureFlagService.get_or_hydrate_flag(feature_name)

    @staticmethod
    async def update_flag(
        feature_name: str,
        enabled: bool = None,
        rollout_percentage: int = None,
        config_json: str = None,
        rules: list[dict] = None
    ) -> dict:
        """Update an existing Feature Flag configuration, replace targeting rules, and propagate changes."""
        async with AsyncSessionLocal() as session:
            try:
                query = select(FeatureFlag).where(FeatureFlag.feature_name == feature_name)
                res = await session.execute(query)
                flag = res.scalar_one_or_none()
                if not flag:
                    raise ValueError(f"Feature flag '{feature_name}' not found.")

                # Update flag fields
                if enabled is not None:
                    flag.enabled = enabled
                if rollout_percentage is not None:
                    flag.rollout_percentage = rollout_percentage
                if config_json is not None:
                    flag.config_json = config_json

                # Replace Targeting Rules if supplied
                if rules is not None:
                    # Clean existing rules
                    del_stmt = delete(FeatureFlagRule).where(FeatureFlagRule.feature_flag_id == flag.id)
                    await session.execute(del_stmt)
                    
                    # Insert new rules
                    for rule in rules:
                        r = FeatureFlagRule(
                            feature_flag_id=flag.id,
                            rule_type=rule["rule_type"],
                            rule_value=rule["rule_value"]
                        )
                        session.add(r)

                flag.updated_at = datetime.utcnow()
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to update feature flag '{feature_name}': {str(e)}")
                raise

        # Invalidate local & cluster caches
        await FeatureFlagService.invalidate_cache(feature_name)

        # Propagate config updates
        await FeatureFlagService.propagate_config_updates(
            feature_name, 
            flag.enabled, 
            flag.rollout_percentage
        )

        return await FeatureFlagService.get_or_hydrate_flag(feature_name)

    @staticmethod
    async def toggle_kill_switch(feature_name: str, enabled: bool) -> dict:
        """Emergency disable or reactivate a feature flag instantly across the cluster."""
        async with AsyncSessionLocal() as session:
            try:
                query = select(FeatureFlag).where(FeatureFlag.feature_name == feature_name)
                res = await session.execute(query)
                flag = res.scalar_one_or_none()
                if not flag:
                    raise ValueError(f"Feature flag '{feature_name}' not found.")

                flag.enabled = enabled
                flag.updated_at = datetime.utcnow()
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to toggle kill switch for '{feature_name}': {str(e)}")
                raise

        if not enabled:
            await FeatureMetrics.increment("kill_switch_activations")
            logger.warning(f"[KILL SWITCH ACTIVATED] Flag '{feature_name}' has been disabled cluster-wide.")

        # Invalidate caches
        await FeatureFlagService.invalidate_cache(feature_name)

        # Propagate updates
        await FeatureFlagService.propagate_config_updates(feature_name, enabled, flag.rollout_percentage)

        return await FeatureFlagService.get_or_hydrate_flag(feature_name)

    @staticmethod
    async def propagate_config_updates(feature_name: str, enabled: bool, rollout_percentage: int):
        """Broadcast updates synchronously to Kafka and Redis Pub/Sub channels to update all nodes in cluster."""
        start_time = time.perf_counter()
        
        payload = {
            "feature_name": feature_name,
            "enabled": enabled,
            "rollout_percentage": rollout_percentage,
            "timestamp": datetime.utcnow().isoformat()
        }

        # 1. Produce message to Kafka topic 'feature.updated'
        try:
            await kafka_manager.send_event(
                key=feature_name,
                value=json.dumps(payload),
                topic="feature.updated"
            )
        except Exception as e:
            logger.error(f"Kafka config propagation failed for '{feature_name}': {str(e)}")

        # 2. Publish to Redis Pub/Sub channel 'features:updates'
        if redis_manager.client:
            try:
                await redis_manager.publish_event("features:updates", payload)
            except Exception as e:
                logger.error(f"Redis Pub/Sub config propagation failed for '{feature_name}': {str(e)}")

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        await FeatureMetrics.increment("propagation_latency_sum_ms", latency_ms)
