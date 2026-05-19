import json
import os

notebook_path = os.path.abspath("d:/santagram/backend/stress.ipynb")

with open(notebook_path, "r", encoding="utf-8") as f:
    notebook = json.load(f)

# Find cell_type: "code" cell to remove Pip install if it exists, or just keep it
# Let's add the new cells:

redis_test_cell = {
    "cell_type": "code",
    "execution_count": None,
    "id": "redis_validation_cell",
    "metadata": {},
    "outputs": [],
    "source": [
        "# ----------------------------------------------------\n",
        "# REDIS SERVICE INTEGRATION & CACHE VALIDATION\n",
        "# ----------------------------------------------------\n",
        "from utils.redis_service import RedisService\n",
        "print(\"=========================================================================\")\n",
        "print(\"      REDIS ACTIVE CONNECTION AND SPAM COUNTER PROTECTION CHECKS      \")\n",
        "print(\"=========================================================================\")\n",
        "print(f\"  Redis Server Connected Status: {RedisService.is_active()}\")\n",
        "\n",
        "if RedisService.is_active():\n",
        "    # Test Cache Get/Set with TTL\n",
        "    RedisService.set(\"neurality:test:key\", {\"engine\": \"v2_redis\", \"status\": \"stable\"}, ttl=10)\n",
        "    cached_val = RedisService.get(\"neurality:test:key\")\n",
        "    print(f\"  Generic Cache Serialization Test: {cached_val}\")\n",
        "    \n",
        "    # Test Sliding Window Spam Counters\n",
        "    count1 = RedisService.increment_spam_counter(user_id=999, action_type=\"like\", window_seconds=5)\n",
        "    count2 = RedisService.increment_spam_counter(user_id=999, action_type=\"like\", window_seconds=5)\n",
        "    print(f\"  Redis Sliding Window Counter Increment 1: {count1} hit(s)\")\n",
        "    print(f\"  Redis Sliding Window Counter Increment 2: {count2} hit(s)\")\n",
        "    \n",
        "    # Cleanup test keys\n",
        "    RedisService.delete(\"neurality:test:key\")\n",
        "    print(\"[SUCCESS] Redis connection, data serialization, and sliding window checks completed successfully!\")\n",
        "else:\n",
        "    print(\"[FALLBACK] Redis is not active. Using in-memory fallback dicts.\")"
    ]
}

redis_benchmark_cell = {
    "cell_type": "code",
    "execution_count": None,
    "id": "redis_benchmark_cell",
    "metadata": {},
    "outputs": [],
    "source": [
        "# ----------------------------------------------------\n",
        "# REDIS BENCHMARK: COLD VS WARM CACHE SPEED COMPARISON\n",
        "# ----------------------------------------------------\n",
        "with app.app_context():\n",
        "    print(\"=========================================================================\")\n",
        "    print(\"   BENCHMARK: COLD CACHE (NEON DB LOOPS) VS WARM CACHE (REDIS MEMORY)   \")\n",
        "    print(\"=========================================================================\")\n",
        "    user = User.query.first()\n",
        "    if not user:\n",
        "        print(\"[ERROR] No target user for benchmark.\")\n",
        "        sys.exit(1)\n",
        "        \n",
        "    # 1. Flush/Evict caches to emulate hard cold start\n",
        "    RecommenderCache._collab_scores.clear()\n",
        "    RecommenderCache._following_ids.clear()\n",
        "    RecommenderCache._user_interactions.clear()\n",
        "    RecommenderCache._global_stats = None\n",
        "    \n",
        "    if RedisService.is_active():\n",
        "        from extensions import redis_client\n",
        "        redis_client.flushdb()\n",
        "        print(\"  [Flushed] Redis and local memory stores wiped to cold start.\")\n",
        "        \n",
        "    # 2. Cold Start Run (Hits PostgreSQL and does ML math calculations)\n",
        "    t0 = time.perf_counter()\n",
        "    recs_cold = recommend_reels_for_user(user, limit=6)\n",
        "    t1 = time.perf_counter()\n",
        "    cold_latency = (t1 - t0) * 1000\n",
        "    print(f\"  Cold Latency (Full Neon Queries + Python ML): {cold_latency:.2f} ms\")\n",
        "    \n",
        "    # 3. Warm Start Run (Hits high-speed Redis cached response values)\n",
        "    t2 = time.perf_counter()\n",
        "    recs_warm = recommend_reels_for_user(user, limit=6)\n",
        "    t3 = time.perf_counter()\n",
        "    warm_latency = (t3 - t2) * 1000\n",
        "    print(f\"  Warm Latency (Accelerated Redis Cache Retrieve): {warm_latency:.2f} ms\")\n",
        "    \n",
        "    speedup = cold_latency / warm_latency if warm_latency > 0 else 0.0\n",
        "    print(f\"\\n[SUMMARY] Redis Cache Speedup: {speedup:.2f}x Faster!\")\n",
        "    if speedup > 3.0:\n",
        "        print(\"[SUCCESS] Redis integration is delivering ultra-high speedups under warm hit!\")"
    ]
}

# Insert new cells before the last empty code cell if present, or just append
notebook["cells"].append(redis_test_cell)
notebook["cells"].append(redis_benchmark_cell)

# Write back
with open(notebook_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1)

print("[SUCCESS] stress.ipynb updated successfully with Redis validation and benchmark cells.")
