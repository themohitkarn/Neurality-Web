import sys
import os
import time

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db
from models.user import User
from models.reel import Reel
from ml.recommender import recommend_reels_for_user

app = create_app()

with app.app_context():
    print("Successfully initialized Flask App Context.")
    
    # Fetch a test user
    user = User.query.first()
    if not user:
        print("[WARNING] No users found in database to test recommendation.")
        sys.exit(0)
        
    print(f"Testing recommendations for User: {user.username} (ID: {user.id})")
    
    # ----------------------------------------------------
    # RUN 1: Cold Cache (Matrix fitting + Neon query compilation)
    # ----------------------------------------------------
    print("\n--- RUN 1: COLD CACHE ---")
    t0 = time.perf_counter()
    recommended1 = recommend_reels_for_user(user, limit=6)
    t1 = time.perf_counter()
    latency_ms_cold = (t1 - t0) * 1000
    print(f"Cold Recommendation generated in {latency_ms_cold:.2f} ms")
    print(f"Recommended Reels Count: {len(recommended1)}")
    
    # ----------------------------------------------------
    # RUN 2: Warm Cache (Instant in-memory lookup)
    # ----------------------------------------------------
    print("\n--- RUN 2: WARM CACHE ---")
    t2 = time.perf_counter()
    recommended2 = recommend_reels_for_user(user, limit=6)
    t3 = time.perf_counter()
    latency_ms_warm = (t3 - t2) * 1000
    print(f"Warm Recommendation generated in {latency_ms_warm:.2f} ms")
    print(f"Recommended Reels Count: {len(recommended2)}")
    
    print("\n----------------------------------------------------")
    print(f"Cache Hit Latency Reduction: {((latency_ms_cold - latency_ms_warm) / latency_ms_cold) * 100:.2%}")
    print(f"Warm Feed Generation Speed: {latency_ms_warm:.2f} ms (Target: <300ms)")
    print("----------------------------------------------------")
    
    for idx, reel in enumerate(recommended2):
        print(f" {idx+1}. Reel ID: {reel.id} | Creator: {reel.author.username} | Tags: {reel.tags} | Views: {reel.views_count}")
        
    print("\n[SUCCESS] Warm vs Cold recommendation query benchmarking completed successfully!")
