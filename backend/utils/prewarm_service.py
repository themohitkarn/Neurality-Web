import logging
import threading
from ml.recommender import recommend_reels_for_user
from models.user import User
from models.reel import Reel
from extensions import db
from utils.redis_service import RedisService

logger = logging.getLogger("neurality")

def prewarm_user_feed(user_id, app):
    """
    Computes recommendation candidates and caches collaborative filtering scores,
    user interactions, and creator following lists in the background.
    """
    def _prewarm():
        try:
            with app.app_context():
                user = db.session.get(User, user_id)
                if not user:
                    return

                logger.info(f"[PREWARMER] Prewarming recommendation candidates for user: {user.username} (ID: {user_id})")
                
                # 1. Warm user-specific recommendation cache
                # Runs the recommender which pushes vectors, interactions & follow lists to Redis
                recommend_reels_for_user(user, limit=12)

                # 2. Pre-cache trending reel pool
                reels = Reel.query.order_by(
                    Reel.views_count.desc(),
                    Reel.created_at.desc()
                ).limit(30).all()

                sorted_reels = sorted(
                    reels,
                    key=lambda r: r.calculate_trending_score(),
                    reverse=True
                )
                
                sorted_ids = [r.id for r in sorted_reels]
                RedisService.set("neurality:trending_reel_ids", sorted_ids, ttl=120)

                logger.info(f"[PREWARMER] Cache prewarmed successfully for user {user.username} (ID: {user_id})")
        except Exception as e:
            logger.error(f"[PREWARMER] Error prewarming cache for user {user_id}: {str(e)}")

    # Execute in a lightweight background thread
    threading.Thread(target=_prewarm, name=f"prewarm-user-{user_id}", daemon=True).start()

def prewarm_global_pools(app):
    """
    Precompute and cache global trending lists.
    """
    def _prewarm_global():
        try:
            with app.app_context():
                logger.info("[PREWARMER] Prewarming global trending pools...")
                reels = Reel.query.order_by(
                    Reel.views_count.desc(),
                    Reel.created_at.desc()
                ).limit(30).all()

                sorted_reels = sorted(
                    reels,
                    key=lambda r: r.calculate_trending_score(),
                    reverse=True
                )
                sorted_ids = [r.id for r in sorted_reels]
                RedisService.set("neurality:trending_reel_ids", sorted_ids, ttl=120)
                logger.info("[PREWARMER] Global trending pools prewarmed successfully.")
        except Exception as e:
            logger.error(f"[PREWARMER] Error prewarming global pools: {str(e)}")

    threading.Thread(target=_prewarm_global, name="prewarm-global-pools", daemon=True).start()
