from collections import defaultdict

from sklearn.neighbors import NearestNeighbors

from extensions import db
from models.associations import followers, post_likes
from models.comment import Comment
from models.post import Post
from models.reel import Reel
from models.user import User
from utils.redis_service import RedisService


def _get_user_following_ids(user_id):
    """Safely fetch followed user IDs directly from the database schema to avoid DetachedInstanceError."""
    rows = db.session.execute(
        db.select(followers.c.followed_id).where(followers.c.follower_id == user_id)
    ).all()
    return {row[0] for row in rows}


def _popular_posts_for_user(user, limit):
    followed_ids = _get_user_following_ids(user.id)

    posts = Post.query.order_by(Post.created_at.desc()).all()
    scored_posts = []
    for post in posts:
        if post.user_id == user.id:
            continue
        if post.author.is_private and post.user_id not in followed_ids:
            continue

        score = (post.liked_by.count() * 2) + post.comments.count()
        if post.user_id in followed_ids:
            score += 3
        scored_posts.append((score, post.created_at.isoformat(), post))

    scored_posts.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [post for _, _, post in scored_posts[:limit]]


def recommend_posts_for_user(user, limit=8):
    users = User.query.order_by(User.id.asc()).all()
    posts = Post.query.order_by(Post.created_at.desc()).all()

    if len(users) < 2 or not posts:
        return _popular_posts_for_user(user, limit)

    user_index = {item.id: index for index, item in enumerate(users)}
    post_index = {item.id: index for index, item in enumerate(posts)}
    author_post_indices = defaultdict(list)

    interaction_matrix = [[0.0 for _ in posts] for _ in users]
    for post in posts:
        author_post_indices[post.user_id].append(post_index[post.id])

    for like_row in db.session.execute(db.select(post_likes.c.user_id, post_likes.c.post_id)):
        liker_id, liked_post_id = like_row
        if liker_id in user_index and liked_post_id in post_index:
            interaction_matrix[user_index[liker_id]][post_index[liked_post_id]] += 3.0

    comment_rows = (
        db.session.query(Comment.user_id, Comment.post_id, db.func.count(Comment.id))
        .group_by(Comment.user_id, Comment.post_id)
        .all()
    )
    for commenter_id, commented_post_id, count in comment_rows:
        if commenter_id in user_index and commented_post_id in post_index:
            interaction_matrix[user_index[commenter_id]][post_index[commented_post_id]] += min(count, 3) * 2.0

    for follow_row in db.session.execute(db.select(followers.c.follower_id, followers.c.followed_id)):
        follower_id, followed_id = follow_row
        if follower_id not in user_index:
            continue
        for target_post_index in author_post_indices.get(followed_id, []):
            interaction_matrix[user_index[follower_id]][target_post_index] += 1.0

    current_user_vector = interaction_matrix[user_index[user.id]]
    if sum(current_user_vector) == 0:
        return _popular_posts_for_user(user, limit)

    neighbor_count = min(6, len(users))
    model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=neighbor_count)
    model.fit(interaction_matrix)

    distances, indices = model.kneighbors([current_user_vector], n_neighbors=neighbor_count)
    collaborative_scores = defaultdict(float)

    interacted_post_ids = {
        post.id
        for post, score in zip(posts, current_user_vector)
        if score > 0
    }
    followed_ids = _get_user_following_ids(user.id)

    for distance, neighbor_index in zip(distances[0], indices[0]):
        neighbor = users[neighbor_index]
        if neighbor.id == user.id:
            continue

        similarity = max(0.0, 1.0 - float(distance))
        if similarity <= 0:
            continue

        neighbor_vector = interaction_matrix[neighbor_index]
        for post in posts:
            if post.id in interacted_post_ids or post.user_id == user.id:
                continue
            if post.author.is_private and post.user_id not in followed_ids:
                continue
            collaborative_scores[post.id] += similarity * neighbor_vector[post_index[post.id]]

    if not collaborative_scores:
        return _popular_posts_for_user(user, limit)

    ranked_posts = []
    for post in posts:
        if post.id not in collaborative_scores or post.user_id == user.id:
            continue
        if post.author.is_private and post.user_id not in followed_ids:
            continue

        score = collaborative_scores[post.id]
        if post.user_id in followed_ids:
            score += 1.5
        score += (post.liked_by.count() * 0.25) + (post.comments.count() * 0.2)
        ranked_posts.append((score, post.created_at.isoformat(), post))

    ranked_posts.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [post for _, _, post in ranked_posts[:limit]]


def calculate_reels_addictive_score(reel, user=None):
    from datetime import datetime
    from collections import defaultdict

    views = reel.views
    total_views = len(views)
    completed_views = sum(1 for v in views if v.completed)
    completion_rate = float(completed_views) / total_views if total_views > 0 else 0.0

    # Calculate average watch ratio normalized by duration
    duration = float(reel.duration or 15.0)
    if duration <= 0.0:
        duration = 15.0
    total_watch_ratio = sum(min(float(v.watch_time or 0) / duration, 1.0) for v in views)
    avg_watch_ratio = total_watch_ratio / float(total_views) if total_views > 0 else 0.0

    # Skip penalty: watches under 2 seconds indicate a skipped reel
    skip_count = sum(1 for v in views if (v.watch_time or 0) < 2)
    skip_penalty = float(skip_count) / total_views if total_views > 0 else 0.0

    # Smart Rates instead of raw counts
    saves = float(reel.saves_count or 0)
    reposts = float(reel.reposted_by.count())
    likes = float(reel.liked_by.count())

    save_rate = saves / total_views if total_views > 0 else 0.0
    repost_rate = reposts / total_views if total_views > 0 else 0.0
    like_rate = likes / total_views if total_views > 0 else 0.0

    # Confidence scaling (weight by view count confidence)
    confidence = min(1.0, float(total_views) / 50.0)

    base_score = (
        (completion_rate * 0.30) +
        (avg_watch_ratio * 0.25) +
        (save_rate * 0.20) +
        (repost_rate * 0.10) +
        (like_rate * 0.10) -
        (skip_penalty * 0.15)
    )

    # Scale by confidence
    base_score *= confidence

    # Following boost & session-based tag intent boost
    if user:
        # 1. Following Boost: creator is followed by user
        followed_ids = _get_user_following_ids(user.id)
        if reel.user_id in followed_ids:
            base_score += 0.1

        # 2. Session tag preference: dynamic learning of active session mood
        from models.reel_view import ReelView
        recent_views = ReelView.query.filter_by(user_id=user.id).order_by(ReelView.viewed_at.desc()).limit(10).all()
        
        tag_weights = defaultdict(float)
        for view in recent_views:
            if (view.watch_time or 0) >= 5 or view.completed:
                for tag in (view.reel.tags or []):
                    tag_weights[tag.lower()] += 1.0

        if tag_weights and reel.tags:
            tag_overlap_boost = sum(tag_weights[tag.lower()] for tag in reel.tags if tag.lower() in tag_weights)
            base_score += min(0.15, tag_overlap_boost * 0.02)

    # Freshness time decay (decay score for older reels)
    hours_old = (datetime.utcnow() - reel.created_at).total_seconds() / 3600.0
    decay = max(1.0, hours_old / 24.0)

    return base_score / decay


def _popular_reels_for_user(user, limit):
    followed_ids = _get_user_following_ids(user.id)
    reels = Reel.query.order_by(Reel.created_at.desc()).all()
    scored_reels = []
    for reel in reels:
        if reel.user_id == user.id:
            continue
        if reel.author.is_private and reel.user_id not in followed_ids:
            continue

        score = calculate_reels_addictive_score(reel, user=user)
        if reel.user_id in followed_ids:
            score += 3.0
        scored_reels.append((score, reel.created_at.isoformat(), reel))

    scored_reels.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [reel for _, _, reel in scored_reels[:limit]]


class RecommenderCache:
    _collab_scores = {}  # Backup user_id -> (timestamp, dict of reel_id -> score)
    _following_ids = {}  # Backup user_id -> (timestamp, set of followed_ids)
    _global_stats = None  # Backup (timestamp, reel_stats_dict, likes_dict, reposts_dict)
    _user_interactions = {}  # Backup user_id -> (timestamp, liked_ids, reposted_ids, saved_ids)

    # EXPLICIT TTL CONFIGURATION RULES (Priority Refinement 3)
    COLLAB_TTL = 180.0       # 3 minutes for user session vectors (Range: 2-5 minutes)
    FOLLOWING_TTL = 180.0    # 3 minutes for followed creators list
    GLOBAL_TTL = 120.0       # 2 minutes for global trending stats pool (Range: 1-3 minutes)
    INTERACTION_TTL = 180.0  # 3 minutes for user interaction likes/saves/reposts sets

    # Live Cache Hit Ratio Tracking Metrics (Priority Refinement 3)
    _hits = 0
    _misses = 0

    @classmethod
    def track_hit(cls):
        cls._hits += 1

    @classmethod
    def track_miss(cls):
        cls._misses += 1

    @classmethod
    def get_hit_ratio(cls):
        total = cls._hits + cls._misses
        return cls._hits / total if total > 0 else 0.0

    @classmethod
    def get_collab_scores(cls, user_id):
        import time
        # Redis Primary
        res = RedisService.get(f"neurality:collab_scores:{user_id}")
        if res is not None:
            cls.track_hit()
            # Redis stores dictionary keys as strings, convert reel keys back to int if needed
            return {int(k): v for k, v in res.items()}
        
        # Local Backup Fallback
        now = time.time()
        if user_id in cls._collab_scores:
            ts, scores = cls._collab_scores[user_id]
            if now - ts < cls.COLLAB_TTL:
                cls.track_hit()
                return scores
        
        cls.track_miss()
        return None

    @classmethod
    def set_collab_scores(cls, user_id, scores):
        import time
        # Redis Primary
        RedisService.set(f"neurality:collab_scores:{user_id}", scores, ttl=cls.COLLAB_TTL)
        # Local Backup Fallback
        cls._collab_scores[user_id] = (time.time(), scores)

    @classmethod
    def get_following_ids(cls, user_id):
        import time
        # Redis Primary
        res = RedisService.get(f"neurality:following_ids:{user_id}")
        if res is not None:
            cls.track_hit()
            return set(res)
            
        # Local Backup Fallback
        now = time.time()
        if user_id in cls._following_ids:
            ts, f_ids = cls._following_ids[user_id]
            if now - ts < cls.FOLLOWING_TTL:
                cls.track_hit()
                return f_ids
        
        cls.track_miss()
        return None

    @classmethod
    def set_following_ids(cls, user_id, f_ids):
        import time
        # Redis Primary
        RedisService.set(f"neurality:following_ids:{user_id}", list(f_ids), ttl=cls.FOLLOWING_TTL)
        # Local Backup Fallback
        cls._following_ids[user_id] = (time.time(), f_ids)

    @classmethod
    def get_global_stats(cls):
        import time
        # Redis Primary
        res = RedisService.get("neurality:global_stats")
        if res is not None:
            cls.track_hit()
            # Convert keys back to integers for the stats & counts
            r_stats = {int(k): v for k, v in res[0].items()}
            l_cnts = {int(k): v for k, v in res[1].items()}
            r_cnts = {int(k): v for k, v in res[2].items()}
            return r_stats, l_cnts, r_cnts
            
        # Local Backup Fallback
        now = time.time()
        if cls._global_stats:
            ts, r_stats, l_cnts, r_cnts = cls._global_stats
            if now - ts < cls.GLOBAL_TTL:
                cls.track_hit()
                return r_stats, l_cnts, r_cnts
        
        cls.track_miss()
        return None

    @classmethod
    def set_global_stats(cls, r_stats, l_cnts, r_cnts):
        import time
        # Redis Primary
        RedisService.set("neurality:global_stats", [r_stats, l_cnts, r_cnts], ttl=cls.GLOBAL_TTL)
        # Local Backup Fallback
        cls._global_stats = (time.time(), r_stats, l_cnts, r_cnts)

    @classmethod
    def get_user_interactions(cls, user_id):
        import time
        # Redis Primary
        res = RedisService.get(f"neurality:user_interactions:{user_id}")
        if res is not None:
            cls.track_hit()
            return set(res[0]), set(res[1]), set(res[2])
            
        # Local Backup Fallback
        now = time.time()
        if user_id in cls._user_interactions:
            ts, l_ids, r_ids, s_ids = cls._user_interactions[user_id]
            if now - ts < cls.INTERACTION_TTL:
                cls.track_hit()
                return l_ids, r_ids, s_ids
        
        cls.track_miss()
        return None

    @classmethod
    def set_user_interactions(cls, user_id, l_ids, r_ids, s_ids):
        import time
        # Redis Primary
        RedisService.set(
            f"neurality:user_interactions:{user_id}", 
            [list(l_ids), list(r_ids), list(s_ids)], 
            ttl=cls.INTERACTION_TTL
        )
        # Local Backup Fallback
        cls._user_interactions[user_id] = (time.time(), l_ids, r_ids, s_ids)


def recommend_reels_for_user(user, limit=8):
    import random
    import time
    from datetime import datetime
    from collections import defaultdict
    from models.reel_view import ReelView
    from models.social import SavedPost
    from sqlalchemy.orm import joinedload

    start_db = time.perf_counter()

    # 0. High-Speed Snapshot Delivery Cache (Bypasses all DB/ML loops for active warm refreshes)
    cached_feed_ids = RedisService.get(f"neurality:feedSnapshot:{user.id}")
    if cached_feed_ids is not None:
        RecommenderCache.track_hit()
        # Eager load only the cached reels, preserving the custom order
        reels_map = {reel.id: reel for reel in Reel.query.options(joinedload(Reel.author)).filter(Reel.id.in_(cached_feed_ids)).all()}
        feed_items = [reels_map[rid] for rid in cached_feed_ids if rid in reels_map]
        if len(feed_items) >= limit:
            db_ms = (time.perf_counter() - start_db) * 1000
            RecommenderCache.latest_profile = {
                "db_ms": round(db_ms, 2),
                "ranking_ms": 0.0
            }
            return feed_items[:limit]

    # 1. Eager load author relation to completely avoid N+1 queries in visibility check
    # Fetch a targeted candidate pool of the last 150 reels to minimize ORM query and hydration overheads
    reels = Reel.query.options(joinedload(Reel.author)).order_by(Reel.created_at.desc()).limit(150).all()
    if not reels:
        RecommenderCache.latest_profile = {"db_ms": 0.0, "ranking_ms": 0.0}
        return []

    # Retrieve or cache followed creators list
    followed_ids = RecommenderCache.get_following_ids(user.id)
    if followed_ids is None:
        followed_ids = _get_user_following_ids(user.id)
        RecommenderCache.set_following_ids(user.id, followed_ids)

    # ----------------------------------------------------
    # PHASE 4: Session-Based Adaptive Memory
    # Eager load reel metadata in a single fast JOIN query
    # ----------------------------------------------------
    from models.associations import reel_likes, reel_reposts
    
    recent_views = ReelView.query.options(joinedload(ReelView.reel)).filter_by(user_id=user.id).order_by(ReelView.viewed_at.desc()).limit(20).all()
    recent_watched_ids = {v.reel_id for v in recent_views}

    # Fetch user likes/reposts/saves in single fast cached queries
    user_interactions = RecommenderCache.get_user_interactions(user.id)
    if user_interactions is None:
        liked_reel_ids = {row[0] for row in db.session.execute(db.select(reel_likes.c.reel_id).where(reel_likes.c.user_id == user.id))}
        reposted_reel_ids = {row[0] for row in db.session.execute(db.select(reel_reposts.c.reel_id).where(reel_reposts.c.user_id == user.id))}
        saved_reel_ids = {row[0] for row in db.session.execute(db.select(SavedPost.reel_id).where(SavedPost.user_id == user.id, SavedPost.reel_id.isnot(None)))}
        RecommenderCache.set_user_interactions(user.id, liked_reel_ids, reposted_reel_ids, saved_reel_ids)
    else:
        liked_reel_ids, reposted_reel_ids, saved_reel_ids = user_interactions

    # ----------------------------------------------------
    # PHASE 2: Creator Repetition Limiter
    # Fetch creators recently watched to apply a soft cooldown penalty
    # ----------------------------------------------------
    recent_creators = [v.reel.user_id for v in recent_views if v.reel]
    creator_counts = defaultdict(int)
    for cid in recent_creators:
        creator_counts[cid] += 1

    # ----------------------------------------------------
    # PHASE 3: Negative Interest Memory
    # CONSECUTIVE SKIP PENALTY SOFTENING (Priority Refinement 2)
    # Punish skips in a safer range (-3.0) to prevent unstable mood overcorrections
    # ----------------------------------------------------
    skipped_tags = defaultdict(int)
    for view in recent_views:
        if (view.watch_time or 0) < 2 and not view.completed:
            if view.reel and view.reel.tags:
                for tag in view.reel.tags:
                    skipped_tags[tag.lower()] += 1

    # Calculate current session mood weights using recency decay
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

        # Softened consecutive skip penalty
        if (view.watch_time or 0) < 2 and not view.completed:
            weight -= 3.0

        if view.reel.tags:
            for tag in view.reel.tags:
                session_tag_weights[tag.lower()] += weight * decay_factor

    # ----------------------------------------------------
    # PHASE 5: Multi-Armed Bandit System (Adaptive Exploration)
    # Scale exploration rate: Min 0.05, Max 0.15 (Conservative Epsilon bounds)
    # ----------------------------------------------------
    total_recent = len(recent_views)
    skipped_recent = sum(1 for v in recent_views if (v.watch_time or 0) < 2 and not v.completed)
    skip_rate = float(skipped_recent) / total_recent if total_recent > 0 else 0.0

    epsilon = 0.15 if skip_rate > 0.40 else 0.05

    # ----------------------------------------------------
    # GLOBAL STATS PRE-COMPUTATION WITH CACHE
    # Build maps of views, completions, likes, reposts to completely avoid ORM loops
    # ----------------------------------------------------
    global_stats = RecommenderCache.get_global_stats()
    if global_stats is None:
        reel_stats = {}
        
        # Populate views stats in a single pass (Limit hydration to the last 1000 views)
        reel_views = ReelView.query.order_by(ReelView.viewed_at.desc()).limit(1000).all()
        for view in reel_views:
            if view.reel_id not in reel_stats:
                reel_stats[view.reel_id] = {
                    "views": 0, "completions": 0, "total_watch_time": 0.0, "skips": 0
                }
            stats = reel_stats[view.reel_id]
            stats["views"] += 1
            if view.completed:
                stats["completions"] += 1
            stats["total_watch_time"] += float(view.watch_time or 0)
            if (view.watch_time or 0) < 2:
                stats["skips"] += 1

        # Group likes in a single query
        likes_counts = {}
        for row in db.session.execute(db.select(reel_likes.c.reel_id, db.func.count(reel_likes.c.user_id)).group_by(reel_likes.c.reel_id)):
            rid, cnt = row
            likes_counts[rid] = cnt

        # Group reposts in a single query
        reposts_counts = {}
        for row in db.session.execute(db.select(reel_reposts.c.reel_id, db.func.count(reel_reposts.c.user_id)).group_by(reel_reposts.c.reel_id)):
            rid, cnt = row
            reposts_counts[rid] = cnt

        RecommenderCache.set_global_stats(dict(reel_stats), dict(likes_counts), dict(reposts_counts))
    else:
        cached_stats, cached_likes, cached_reposts = global_stats
        
        # Reconstruct mapping containers
        reel_stats = cached_stats
        likes_counts = cached_likes
        reposts_counts = cached_reposts

    # Helper helper to safely fetch stats in O(1)
    def get_reel_stats(rid):
        return reel_stats.get(rid, {"views": 0, "completions": 0, "total_watch_time": 0.0, "skips": 0})

    # ----------------------------------------------------
    # COLLABORATIVE FILTERING CORE with Warm In-Memory Cache
    # Bypass user loading and NearestNeighbors fitting if warm
    # ----------------------------------------------------
    collaborative_scores = RecommenderCache.get_collab_scores(user.id)
    if collaborative_scores is None:
        collaborative_scores = defaultdict(float)
        users = User.query.order_by(User.id.asc()).all()

        if len(users) >= 2:
            user_index = {item.id: index for index, item in enumerate(users)}
            reel_index = {item.id: index for index, item in enumerate(reels)}
            author_reel_indices = defaultdict(list)

            interaction_matrix = [[0.0 for _ in reels] for _ in users]
            for reel in reels:
                author_reel_indices[reel.user_id].append(reel_index[reel.id])

            for like_row in db.session.execute(db.select(reel_likes.c.user_id, reel_likes.c.reel_id)):
                liker_id, liked_reel_id = like_row
                if liker_id in user_index and liked_reel_id in reel_index:
                    interaction_matrix[user_index[liker_id]][reel_index[liked_reel_id]] += 5.0

            # Use in-memory reel_views scan if we constructed it, otherwise fetch (Limit hydration to the last 1000 views)
            if global_stats is None:
                views_list = reel_views
            else:
                views_list = ReelView.query.order_by(ReelView.viewed_at.desc()).limit(1000).all()

            for view in views_list:
                if view.user_id in user_index and view.reel_id in reel_index:
                    u_idx = user_index[view.user_id]
                    r_idx = reel_index[view.reel_id]
                    score = (view.watch_time or 0) * 0.5
                    if view.completed:
                        score += 10.0
                    interaction_matrix[u_idx][r_idx] += score

            for follow_row in db.session.execute(db.select(followers.c.follower_id, followers.c.followed_id)):
                follower_id, followed_id = follow_row
                if follower_id not in user_index:
                    continue
                for target_reel_index in author_reel_indices.get(followed_id, []):
                    interaction_matrix[user_index[follower_id]][target_reel_index] += 1.0

            current_user_vector = interaction_matrix[user_index[user.id]]

            if sum(current_user_vector) > 0:
                neighbor_count = min(6, len(users))
                model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=neighbor_count)
                model.fit(interaction_matrix)

                distances, indices = model.kneighbors([current_user_vector], n_neighbors=neighbor_count)

                interacted_reel_ids = {
                    reel.id
                    for reel, score in zip(reels, current_user_vector)
                    if score > 0
                }

                for distance, neighbor_index in zip(distances[0], indices[0]):
                    neighbor = users[neighbor_index]
                    if neighbor.id == user.id:
                        continue

                    similarity = max(0.0, 1.0 - float(distance))
                    if similarity <= 0:
                        continue

                    neighbor_vector = interaction_matrix[neighbor_index]
                    for reel in reels:
                        if reel.id in interacted_reel_ids or reel.user_id == user.id:
                            continue
                        collaborative_scores[reel.id] += similarity * neighbor_vector[reel_index[reel.id]]

        # Cache standard dict for subsequent calls
        RecommenderCache.set_collab_scores(user.id, dict(collaborative_scores))
    else:
        # Re-convert to defaultdict to handle missing keys gracefully
        cached_scores = collaborative_scores
        collaborative_scores = defaultdict(float)
        collaborative_scores.update(cached_scores)

    db_ms = (time.perf_counter() - start_db) * 1000
    start_rank = time.perf_counter()

    # ----------------------------------------------------
    # CANDIDATE SCORING PIPELINE (O(1) database complexity)
    # ----------------------------------------------------
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

        # Phase 2: Recent Creator Penalty
        creator_penalty = creator_counts[reel.user_id] * 0.25

        # Phase 3: Negative Interest Tag Penalty
        skip_penalty = 0.0
        if reel.tags:
            for tag in reel.tags:
                skip_penalty += skipped_tags[tag.lower()] * 0.15

        # Phase 4: Session Affinity Boost
        session_boost = 0.0
        if reel.tags:
            for tag in reel.tags:
                session_boost += session_tag_weights[tag.lower()] * 0.05

        # Hard Cap Session-Interest Boost (Priority Improvement: Overfitting Protection)
        session_boost = min(session_boost, 0.15)

        # Pre-computed Addictive Score to completely avoid nested queries
        stats = get_reel_stats(reel.id)
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

        # Following boost & session tag overlap boost
        if reel.user_id in followed_ids:
            base_score += 0.1
        if session_tag_weights and reel.tags:
            tag_overlap_boost = sum(session_tag_weights[t.lower()] * 0.02 for t in reel.tags if t.lower() in session_tag_weights)
            base_score += min(0.15, tag_overlap_boost)

        # Freshness time decay
        hours_old = (datetime.utcnow() - reel.created_at).total_seconds() / 3600.0
        decay = max(1.0, hours_old / 24.0)
        addictive_score = base_score / decay

        # Phase 5: Exploration Bandit Epsilon Noise
        exploration_noise = random.uniform(0, epsilon)

        # Combined adaptive ranking score
        final_score = (
            base_collab * 0.5 +
            addictive_score * 0.3 +
            session_boost * 0.2 -
            creator_penalty -
            skip_penalty +
            exploration_noise
        )

        # FOLLOW CREATOR WEIGHT REBALANCING (Priority Refinement 1)
        # Soft boost set to +4.0 (Recommended safe range: +3.5 to +4.5) to avoid over-domination
        if reel.user_id in followed_ids:
            final_score += 4.0

        scored_reels.append((final_score, reel))

    if not scored_reels:
        ranking_ms = (time.perf_counter() - start_rank) * 1000
        RecommenderCache.latest_profile = {
            "db_ms": round(db_ms, 2),
            "ranking_ms": round(ranking_ms, 2)
        }
        fallback_reels = _popular_reels_for_user(user, limit)
        fallback_ids = [r.id for r in fallback_reels]
        if fallback_ids:
            RedisService.set(f"neurality:feedSnapshot:{user.id}", fallback_ids, ttl=45)
        return fallback_reels

    # ----------------------------------------------------
    # PHASE 1: Mixed Feed Engine Blending
    # Session (50%), Trending (20%), Following (20%), Explore (10%)
    # ----------------------------------------------------
    target_collab = max(1, int(limit * 0.50))
    target_trending = max(1, int(limit * 0.20))
    target_following = max(1, int(limit * 0.20))
    target_explore = max(1, limit - (target_collab + target_trending + target_following))

    # Re-align target sizes to match limit exactly
    allocated = target_collab + target_trending + target_following + target_explore
    if allocated != limit:
        target_collab += (limit - allocated)

    collab_list = sorted(scored_reels, key=lambda x: x[0], reverse=True)

    # Collaborative feed should prioritize unseen reels
    unseen_collab = [item for item in collab_list if item[1].id not in recent_watched_ids]
    if len(unseen_collab) < target_collab:
        unseen_collab = collab_list

    following_list = [item for item in collab_list if item[1].user_id in followed_ids]
    
    # In-memory trending score computation to avoid SQL hits
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

    # ----------------------------------------------------
    # RANDOM EXPLORE SLOT PROTECTION (Priority Refinement 4)
    # Ensure final deduplication logic does NOT accidentally remove exploration slots
    # Filter out high-affinity collab reels (top 50%) from explore pool to ensure true novelty discovery
    # ----------------------------------------------------
    collab_ids = {item[1].id for item in collab_list[:len(collab_list)//2]}
    pure_explore_candidates = [item for item in explore_list if item[1].id not in collab_ids]
    if len(pure_explore_candidates) < target_explore:
        pure_explore_candidates = explore_list

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

    # Blend the feeds sequentially with pure explore slots protected from collab collisions
    add_from_candidates(unseen_collab, target_collab)
    add_from_candidates(trending_list, target_trending)
    add_from_candidates(following_list, target_following)
    add_from_candidates(pure_explore_candidates, target_explore)

    # Fallback to general ranked list if still short
    if len(feed_items) < limit:
        add_from_candidates(collab_list, limit - len(feed_items))

    ranking_ms = (time.perf_counter() - start_rank) * 1000
    RecommenderCache.latest_profile = {
        "db_ms": round(db_ms, 2),
        "ranking_ms": round(ranking_ms, 2)
    }

    # Cache recommendation snapshot in Redis for 45 seconds to guarantee ultra-fast delivery
    feed_ids = [r.id for r in feed_items]
    if feed_ids:
        RedisService.set(f"neurality:feedSnapshot:{user.id}", feed_ids, ttl=45)

    return feed_items[:limit]
