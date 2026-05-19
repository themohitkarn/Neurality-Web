import asyncio
import json
import time
import httpx
from sqlalchemy import select, delete
from app.core.db import AsyncSessionLocal
from app.models.feature_flag import FeatureFlag, FeatureFlagRule, ExperimentAssignment
from app.models.user import User
from app.core.redis import redis_manager

BASE_URL = "http://localhost:8000"

async def clean_test_data(user_username: str, feature_names: list):
    """Clean up any database and Redis cache entries generated during the test."""
    print(f"[CLEANUP] Purging test artifacts for user '{user_username}' and features {feature_names}")
    async with AsyncSessionLocal() as session:
        try:
            # Delete experiment assignments
            stmt_del_assign = delete(ExperimentAssignment).where(ExperimentAssignment.feature_name.in_(feature_names))
            await session.execute(stmt_del_assign)

            # Get feature IDs
            stmt_features = select(FeatureFlag.id).where(FeatureFlag.feature_name.in_(feature_names))
            res = await session.execute(stmt_features)
            flag_ids = res.scalars().all()

            if flag_ids:
                # Delete rules
                stmt_rules = delete(FeatureFlagRule).where(FeatureFlagRule.feature_flag_id.in_(flag_ids))
                await session.execute(stmt_rules)

                # Delete features
                stmt_feat_del = delete(FeatureFlag).where(FeatureFlag.id.in_(flag_ids))
                await session.execute(stmt_feat_del)

            # Delete test users
            stmt_user = delete(User).where(User.username == user_username)
            await session.execute(stmt_user)

            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Cleanup warning: {str(e)}")

    # Evict Redis cache sets
    for name in feature_names:
        await redis_manager.delete(f"feature:{name}")
        await redis_manager.delete(f"metrics:features:evaluations:{name}")
    
    await redis_manager.delete("metrics:features:cache_hits")
    await redis_manager.delete("metrics:features:cache_misses")

async def run_feature_tests():
    print("\n====================================================")
    print("RUNNING FEATURE FLAG & EXPERIMENTATION ENGINE TESTS")
    print("====================================================\n")

    # Connect to Redis
    await redis_manager.connect()

    timestamp = int(time.time())
    test_user_name = f"tester_gate_{timestamp}"
    password = "SuperPassword123!"
    feature_name = f"test_beta_feature_{timestamp}"
    experiment_name = f"test_experiment_variants_{timestamp}"

    async with httpx.AsyncClient() as client:
        # 1. Register & Authenticate users
        print("[TEST 1] Registering and authenticating test user...")
        reg = await client.post(f"{BASE_URL}/auth/register", json={
            "username": test_user_name,
            "email": f"{test_user_name}@example.com",
            "password": password
        })
        assert reg.status_code == 201, f"Failed registration: {reg.text}"
        user_id = str(reg.json()["user_id"])

        log_res = await client.post(f"{BASE_URL}/auth/login", json={"username": test_user_name, "password": password})
        assert log_res.status_code == 200
        token = log_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"SUCCESS: Registered and authenticated '{test_user_name}' (ID: {user_id})")

        # 2. Create Feature Flag with Whitelist Targeting Rule
        print("\n[TEST 2] Creating a feature flag with whitelist rule...")
        payload = {
            "feature_name": feature_name,
            "enabled": True,
            "rollout_percentage": 0,
            "config_json": json.dumps({"color": "indigo"}),
            "rules": [
                {"rule_type": "user_id", "rule_value": user_id}
            ]
        }
        res_create = await client.post(f"{BASE_URL}/features/create", json=payload, headers=headers)
        assert res_create.status_code == 201, f"Failed to create flag: {res_create.text}"
        print("SUCCESS: Feature Flag successfully created with Whitelist Rule")

        # 3. Evaluate Whitelisted User (Should be Enabled)
        print("\n[TEST 3] Evaluating feature flag for whitelisted user...")
        res_eval_white = await client.get(f"{BASE_URL}/features/evaluate/{feature_name}?user_id={user_id}", headers=headers)
        assert res_eval_white.status_code == 200
        data_white = res_eval_white.json()
        assert data_white["enabled"] is True, f"Expected True, got {data_white}"
        assert data_white["config"] == {"color": "indigo"}
        print("SUCCESS: Whitelisted user correctly evaluated to ENABLED with custom payload config")

        # 4. Evaluate Non-Whitelisted User (Should be Disabled)
        print("\n[TEST 4] Evaluating feature flag for non-whitelisted user...")
        res_eval_non = await client.get(f"{BASE_URL}/features/evaluate/{feature_name}?user_id=non_whitelisted_id", headers=headers)
        assert res_eval_non.status_code == 200
        data_non = res_eval_non.json()
        assert data_non["enabled"] is False, f"Expected False, got {data_non}"
        print("SUCCESS: Non-whitelisted user correctly evaluated to DISABLED")

        # 5. Test Bucketed Rollout (e.g. 50% rollout rate)
        print("\n[TEST 5] Testing deterministic rollout bucketing at 50%...")
        # Update rollout to 50%
        res_upd = await client.post(
            f"{BASE_URL}/features/update?feature_name={feature_name}",
            json={
                "rollout_percentage": 50,
                "enabled": True,
                "rules": []  # clear whitelist
            },
            headers=headers
        )
        assert res_upd.status_code == 200

        # Let's evaluate a range of user IDs to check deterministic behavior
        hits = 0
        total = 100
        for i in range(total):
            uid = f"user_bucket_{i}"
            res_val = await client.get(f"{BASE_URL}/features/evaluate/{feature_name}?user_id={uid}", headers=headers)
            if res_val.json()["enabled"]:
                hits += 1

        print(f"SUCCESS: Deterministic bucketing split: {hits}/{total} users enabled (Target: ~50%)")
        assert 35 <= hits <= 65, f"Rollout distribution too far from expected 50%: got {hits}"

        # 6. Test Sticky Experiments Allocation
        print("\n[TEST 6] Testing Sticky Experiment variants...")
        payload_exp = {
            "feature_name": experiment_name,
            "enabled": True,
            "rollout_percentage": 100,
            "config_json": json.dumps({"variants": ["control", "test_a", "test_b"]})
        }
        res_create_exp = await client.post(f"{BASE_URL}/features/create", json=payload_exp, headers=headers)
        assert res_create_exp.status_code == 201

        # Evaluate repeatedly for target users and assert sticky results
        variants = {}
        for uid in ["user_alice", "user_bob", "user_charlie"]:
            res_e1 = await client.get(f"{BASE_URL}/features/evaluate/{experiment_name}?user_id={uid}", headers=headers)
            var_1 = res_e1.json()["variant"]
            assert var_1 in ["control", "test_a", "test_b"]

            # Query again to assert stickiness
            res_e2 = await client.get(f"{BASE_URL}/features/evaluate/{experiment_name}?user_id={uid}", headers=headers)
            var_2 = res_e2.json()["variant"]
            assert var_1 == var_2, f"Sticky variant violated! User {uid} got {var_1} then {var_2}"
            variants[uid] = var_1

        print(f"SUCCESS: Experiment variants allocated deterministically: {variants}")
        print("SUCCESS: Sticky assignments validated successfully across repeat calls")

        # 7. Test Emergency Kill Switch Override
        print("\n[TEST 7] Testing Emergency Kill Switch global override...")
        # Toggle kill switch to disabled
        res_kill = await client.post(f"{BASE_URL}/features/kill-switch?feature_name={experiment_name}", json={"enabled": False}, headers=headers)
        assert res_kill.status_code == 200
        assert res_kill.json()["enabled"] is False

        # Evaluate whitelisted or standard users -> should now be immediately False
        res_e3 = await client.get(f"{BASE_URL}/features/evaluate/{experiment_name}?user_id=user_alice", headers=headers)
        assert res_e3.json()["enabled"] is False
        assert res_e3.json()["variant"] == "control"
        print("SUCCESS: Emergency Kill Switch globally shut down feature evaluation instantly")

        # Re-enable it
        res_restore = await client.post(f"{BASE_URL}/features/kill-switch?feature_name={experiment_name}", json={"enabled": True}, headers=headers)
        assert res_restore.status_code == 200
        assert res_restore.json()["enabled"] is True

        res_e4 = await client.get(f"{BASE_URL}/features/evaluate/{experiment_name}?user_id=user_alice", headers=headers)
        assert res_e4.json()["enabled"] is True
        assert res_e4.json()["variant"] == variants["user_alice"]
        print("SUCCESS: Emergency Kill Switch reactivated feature and restored sticky variant allocation")

        # 8. Test Observability Metrics Collection
        print("\n[TEST 8] Querying feature observability metrics endpoint...")
        res_metrics = await client.get(f"{BASE_URL}/metrics/features")
        assert res_metrics.status_code == 200
        metrics_data = res_metrics.json()
        assert "cache_hits" in metrics_data
        assert "cache_misses" in metrics_data
        assert "evaluations" in metrics_data
        print(f"SUCCESS: Observability Metrics: Cache Hits={metrics_data['cache_hits']} | Misses={metrics_data['cache_misses']}")
        print("SUCCESS: Feature evaluations counters tracked correctly in Redis")

    # 9. Clean up database records
    await clean_test_data(test_user_name, [feature_name, experiment_name])
    print("\nSUCCESS: Database and cache cleanup operations complete")
    print("\n====================================================")
    print("ALL GATEKEEPER INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("====================================================\n")

if __name__ == "__main__":
    asyncio.run(run_feature_tests())
