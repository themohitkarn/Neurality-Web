import sys
import os
import time

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db
from models.user import User
from models.reel import Reel
from models.reel_view import ReelView
from models.social import SavedPost
from sqlalchemy.orm import joinedload
from models.associations import reel_likes, reel_reposts, followers
from ml.recommender import RecommenderCache

app = create_app()

with app.app_context():
    print("--- TIMING DEBUGGING ---")
    user = User.query.first()
    if not user:
        print("No users found.")
        sys.exit(0)

    # Warm cache cold run first
    from ml.recommender import recommend_reels_for_user
    recommend_reels_for_user(user)

    print("\nStarting timed RUN 2 (Fully Warm Cache)...")
    
    t_start = time.perf_counter()
    
    # Measure Reels Fetch
    t0 = time.perf_counter()
    reels = Reel.query.options(joinedload(Reel.author)).order_by(Reel.created_at.desc()).all()
    t1 = time.perf_counter()
    print(f"1. Reels Query with joinedload(author) took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure followed creators
    t0 = time.perf_counter()
    followed_ids = RecommenderCache.get_following_ids(user.id)
    if followed_ids is None:
        followed_ids = {followed.id for followed in user.following.all()}
        RecommenderCache.set_following_ids(user.id, followed_ids)
    t1 = time.perf_counter()
    print(f"2. Followed Creators lookup (Cached) took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure session view query
    t0 = time.perf_counter()
    recent_views = ReelView.query.options(joinedload(ReelView.reel)).filter_by(user_id=user.id).order_by(ReelView.viewed_at.desc()).limit(20).all()
    recent_watched_ids = {v.reel_id for v in recent_views}
    t1 = time.perf_counter()
    print(f"3. Recent Views Query took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure User interaction IDs queries with caching
    t0 = time.perf_counter()
    user_interactions = RecommenderCache.get_user_interactions(user.id)
    if user_interactions is None:
        liked_reel_ids = {row[0] for row in db.session.execute(db.select(reel_likes.c.reel_id).where(reel_likes.c.user_id == user.id))}
        reposted_reel_ids = {row[0] for row in db.session.execute(db.select(reel_reposts.c.reel_id).where(reel_reposts.c.user_id == user.id))}
        saved_reel_ids = {row[0] for row in db.session.execute(db.select(SavedPost.reel_id).where(SavedPost.user_id == user.id, SavedPost.reel_id.isnot(None)))}
        RecommenderCache.set_user_interactions(user.id, liked_reel_ids, reposted_reel_ids, saved_reel_ids)
    else:
        liked_reel_ids, reposted_reel_ids, saved_reel_ids = user_interactions
    t1 = time.perf_counter()
    print(f"4. Liked/Reposted/Saved IDs fetch (Cached) took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure creator penalty counting
    t0 = time.perf_counter()
    from collections import defaultdict
    recent_creators = [v.reel.user_id for v in recent_views if v.reel]
    creator_counts = defaultdict(int)
    for cid in recent_creators:
        creator_counts[cid] += 1
    t1 = time.perf_counter()
    print(f"5. Creator repetition counting took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure tag penalty and session weights
    t0 = time.perf_counter()
    skipped_tags = defaultdict(int)
    for view in recent_views:
        if (view.watch_time or 0) < 2 and not view.completed:
            if view.reel and view.reel.tags:
                for tag in view.reel.tags:
                    skipped_tags[tag.lower()] += 1
                    
    session_tag_weights = defaultdict(float)
    for index, view in enumerate(recent_views):
        if not view.reel:
            continue
        decay_factor = 0.90 ** index
        duration = float(view.reel.duration or 15.0)
        if duration <= 0:
            duration = 15.0
        watch_ratio = min(float(view.watch_time or 0) / duration, 1.0)
        weight = watch_ratio * 1.0
        if view.completed:
            weight += 1.5
        if view.reel_id in liked_reel_ids:
            weight += 2.0
        if view.reel_id in reposted_reel_ids:
            weight += 2.0
        if view.reel_id in saved_reel_ids:
            weight += 2.5
        if (view.watch_time or 0) < 2 and not view.completed:
            weight -= 1.5
        if view.reel.tags:
            for tag in view.reel.tags:
                session_tag_weights[tag.lower()] += weight * decay_factor
    t1 = time.perf_counter()
    print(f"6. Skipping and session weighting took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure Global Stats fetch from cache
    t0 = time.perf_counter()
    global_stats = RecommenderCache.get_global_stats()
    cached_stats, cached_likes, cached_reposts = global_stats
    reel_stats = cached_stats
    likes_counts = cached_likes
    reposts_counts = cached_reposts
    t1 = time.perf_counter()
    print(f"7. Global Stats Cache fetch took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure Collaborative Scores lookup
    t0 = time.perf_counter()
    collaborative_scores = RecommenderCache.get_collab_scores(user.id)
    cached_scores = collaborative_scores
    collaborative_scores = defaultdict(float)
    collaborative_scores.update(cached_scores)
    t1 = time.perf_counter()
    print(f"8. Collaborative Cache lookup took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure candidate loops and calculations
    t0 = time.perf_counter()
    scored_reels = []
    
    def is_visible(reel):
        if reel.user_id == user.id:
            return True
        if reel.author.is_private and reel.user_id not in followed_ids:
            return False
        return True
        
    for reel in reels:
        if not is_visible(reel):
            continue
        if reel.user_id == user.id:
            continue
            
        base_collab = collaborative_scores[reel.id]
        creator_penalty = creator_counts[reel.user_id] * 0.25
        
        skip_penalty = 0.0
        if reel.tags:
            for tag in reel.tags:
                skip_penalty += skipped_tags[tag.lower()] * 0.15
                
        session_boost = 0.0
        if reel.tags:
            for tag in reel.tags:
                session_boost += session_tag_weights[tag.lower()] * 0.05
        session_boost = min(session_boost, 0.15)
        
        stats = reel_stats.get(reel.id, {"views": 0, "completions": 0, "total_watch_time": 0.0, "skips": 0})
        total_views = stats["views"]
        
        if total_views > 0:
            completion_rate = float(stats["completions"]) / total_views
            duration = float(reel.duration or 15.0)
            if duration <= 0:
                duration = 15.0
            avg_watch_ratio = min((stats["total_watch_time"] / duration) / total_views, 1.0)
            skip_penalty_val = float(stats["skips"]) / total_views
            saves = float(reel.saves_count or 0)
            reposts = float(reposts_counts.get(reel.id, 0))
            likes = float(likes_counts.get(reel.id, 0))
            save_rate = saves / total_views
            repost_rate = reposts / total_views
            like_rate = likes / total_views
            confidence = min(1.0, float(total_views) / 50.0)
            base_score = (
                (completion_rate * 0.30) +
                (avg_watch_ratio * 0.25) +
                (save_rate * 0.20) +
                (repost_rate * 0.10) +
                (like_rate * 0.10) -
                (skip_penalty_val * 0.15)
            )
            base_score *= confidence
        else:
            base_score = 0.0
            
        if reel.user_id in followed_ids:
            base_score += 0.1
        if session_tag_weights and reel.tags:
            tag_overlap_boost = sum(session_tag_weights[t.lower()] * 0.02 for t in reel.tags if t.lower() in session_tag_weights)
            base_score += min(0.15, tag_overlap_boost)
            
        import datetime
        hours_old = (datetime.datetime.utcnow() - reel.created_at).total_seconds() / 3600.0
        decay = max(1.0, hours_old / 24.0)
        addictive_score = base_score / decay
        
        import random
        exploration_noise = random.uniform(0, 0.05)
        
        final_score = (
            base_collab * 0.5 +
            addictive_score * 0.3 +
            session_boost * 0.2 -
            creator_penalty -
            skip_penalty +
            exploration_noise
        )
        if reel.user_id in followed_ids:
            final_score += 1.5
            
        scored_reels.append((final_score, reel))
    t1 = time.perf_counter()
    print(f"9. Candidate visibility check and scoring loop took: {(t1 - t0)*1000:.2f} ms")
    
    # Measure feed blending and selection with in-memory trending
    t0 = time.perf_counter()
    target_collab = max(1, int(6 * 0.50))
    target_trending = max(1, int(6 * 0.20))
    target_following = max(1, int(6 * 0.20))
    target_explore = max(1, 6 - (target_collab + target_trending + target_following))
    
    collab_list = sorted(scored_reels, key=lambda x: x[0], reverse=True)
    unseen_collab = [item for item in collab_list if item[1].id not in recent_watched_ids]
    if len(unseen_collab) < target_collab:
        unseen_collab = collab_list
        
    following_list = [item for item in collab_list if item[1].user_id in followed_ids]
    
    def get_trending_score_in_memory(reel):
        likes = likes_counts.get(reel.id, 0)
        reposts = reposts_counts.get(reel.id, 0)
        return (
            (reel.views_count or 0) * 0.5 +
            reposts * 4 +
            likes * 2 +
            (reel.saves_count or 0) * 3
        )
        
    trending_list = sorted(scored_reels, key=lambda x: get_trending_score_in_memory(x[1]), reverse=True)
    explore_list = list(scored_reels)
    random.shuffle(explore_list)
    
    feed_items = []
    seen_ids = set()
    
    def add_from_candidates(source_list, count):
        added = 0
        for score, reel in source_list:
            if reel.id not in seen_ids:
                seen_ids.add(reel.id)
                feed_items.append(reel)
                added += 1
                if added >= count:
                    break
        return added
        
    add_from_candidates(unseen_collab, target_collab)
    add_from_candidates(trending_list, target_trending)
    add_from_candidates(following_list, target_following)
    add_from_candidates(explore_list, target_explore)
    
    if len(feed_items) < 6:
        add_from_candidates(collab_list, 6 - len(feed_items))
    t1 = time.perf_counter()
    print(f"10. Blending and selection (Cached Trending) took: {(t1 - t0)*1000:.2f} ms")
    
    t_end = time.perf_counter()
    print(f"\nTotal Timed Execution: {(t_end - t_start)*1000:.2f} ms")
