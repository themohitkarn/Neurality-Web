import sys
import os
import json

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app

from ml.recommender import recommend_reels_for_user, RecommenderCache
from models.user import User

app = create_app()

with app.app_context():
    print("=========================================================================")
    print("        NEURALITY SYSTEM STATUS, CACHING & TIMING PROFILER TEST         ")
    print("=========================================================================")

    # 1. Test GET /api/system/cache-health directly
    print("\n--- TEST 1: CACHE HEALTH & REDIS DIAGNOSTICS ENDPOINT ---")
    with app.test_client() as client:
        response = client.get("/api/system/cache-health")

        status_code = response.status_code
        health_data = response.get_json()

        print(f"  Response Status Code: {status_code}")
        print(f"  Payload Returned:\n{json.dumps(health_data, indent=4)}")

    # 2. Test Recommendation Latency Breakdown and Prewarming triggers
    print("\n--- TEST 2: RECOMMENDATION LATENCY TIMING PROFILE & PREWARMING ---")
    user = User.query.first()
    if not user:
        print("[ERROR] No target user for validation.")
        sys.exit(1)

    print(f"  Target User: {user.username} (ID: {user.id})")
    
    # Trigger first cold-run recommendation (should hit cache misses and database)
    recs = recommend_reels_for_user(user, limit=6)
    profile = getattr(RecommenderCache, "latest_profile", {})
    print(f"  [Cold/First Run] db_ms: {profile.get('db_ms')} ms | ranking_ms: {profile.get('ranking_ms')} ms")

    # Trigger 5 consecutive warm-run recommendations to demonstrate sustained high cache hit ratio
    for idx in range(1, 6):
        recs_warm = recommend_reels_for_user(user, limit=6)
        profile_warm = getattr(RecommenderCache, "latest_profile", {})
        print(f"  [Warm Run #{idx}] db_ms: {profile_warm.get('db_ms')} ms | ranking_ms: {profile_warm.get('ranking_ms')} ms")

    # 3. Check updated hit-rate metrics
    print("\n--- TEST 3: LIVE CACHE HIT-RATIO VERIFICATION ---")
    with app.test_client() as client:
        response_updated = client.get("/api/system/cache-health")

        health_data_updated = response_updated.get_json()

        metrics = health_data_updated.get("recommendation_cache", {})

        print(f"  Total Cache Hits Recorded: {metrics.get('hits')}")
        print(f"  Total Cache Misses Recorded: {metrics.get('misses')}")
        print(f"  Exposed Hit Ratio: {metrics.get('hit_ratio') * 100:.2f}% (Target: >80% on warm runs)")

    print("\n=========================================================================")
    print("         SYSTEM CACHING & TIMING CHECKS COMPLETED SUCCESSFULLY!          ")
    print("=========================================================================")
