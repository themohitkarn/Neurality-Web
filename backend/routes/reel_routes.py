from sqlalchemy import or_
from flask import Blueprint, g, jsonify, request

import re
from extensions import db, limiter
from models.reel import Reel
from models.reel_view import ReelView
from models.user import User
from models.social import BlockedUser, HiddenContent
from utils.jwt_helper import token_required
from utils.video_handler import delete_video
from utils.cloudinary_handler import upload_video_to_cloudinary, delete_video_from_cloudinary


reel_bp = Blueprint("reels", __name__)


@reel_bp.post("/upload")
@limiter.limit("5 per minute")
@token_required
def upload_reel():
    import bleach
    caption = bleach.clean((request.form.get("caption") or "").strip())
    tags = re.findall(r"#(\w+)", caption.lower())
    video = request.files.get("video")
    is_muted = request.form.get("is_muted") == "true"
    aspect_ratio = request.form.get("aspect_ratio") or "9:16"
    width = request.form.get("width")
    height = request.form.get("height")
    orientation = request.form.get("orientation") or "portrait"

    if not video or not video.filename:
        return jsonify({"message": "A video file is required for reels."}), 400

    try:
        # Upload directly to Cloudinary
        upload_data = upload_video_to_cloudinary(video)
        
        reel = Reel(
            user_id=g.current_user.id,
            video_path=upload_data["video_url"],
            thumbnail_path=upload_data["thumbnail_url"],
            cloudinary_public_id=upload_data["public_id"],
            width=int(width) if width else None,
            height=int(height) if height else None,
            aspect_ratio=aspect_ratio,
            orientation=orientation,
            is_muted=is_muted,
            caption=caption or None,
            tags=tags,
        )
        db.session.add(reel)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        # Cleanup if something failed after upload
        if 'upload_data' in locals():
            delete_video_from_cloudinary(upload_data["public_id"])
        return jsonify({"message": f"Unable to upload reel: {exc}"}), 500

    return jsonify({"message": "Reel uploaded successfully.", "reel": reel.to_dict(g.current_user.id)}), 201

@reel_bp.route("/<int:reel_id>/view", methods=["POST"])
@limiter.limit("120 per minute")
@token_required
def add_reel_view(reel_id):

    reel = db.session.get(Reel, reel_id)

    if not reel:
        return jsonify({
            "message": "Reel not found"
        }), 404
    
    if reel.user_id == g.current_user.id:
        return jsonify({
            "message": "Own reel view ignored",
            "views_count": reel.views_count
        }), 200

    existing_view = ReelView.query.filter_by(
        reel_id=reel_id,
        user_id=g.current_user.id
    ).first()

    if existing_view:
        return jsonify({
            "message": "Already viewed",
            "views_count": reel.views_count
        }), 200

    new_view = ReelView(
        reel_id=reel_id,
        user_id=g.current_user.id,
        watch_time=3
    )

    try:
        db.session.add(new_view)
        Reel.query.filter_by(id=reel_id).update({
            Reel.views_count: Reel.views_count + 1
        })
        db.session.commit()
        db.session.refresh(reel)
    except Exception:
        db.session.rollback()
        return jsonify({
            "message": "Already viewed",
            "views_count": reel.views_count
        }), 200

    return jsonify({
        "message": "View added",
        "views_count": reel.views_count
    }), 201

@reel_bp.post("/<int:reel_id>/watch-progress")
@limiter.limit("120 per minute")
@token_required
def update_watch_progress(reel_id):
    view = ReelView.query.filter_by(
        reel_id=reel_id,
        user_id=g.current_user.id
    ).first()

    if not view:
        reel = db.session.get(Reel, reel_id)
        if not reel:
            return jsonify({"message": "Reel not found"}), 404
        
        view = ReelView(
            reel_id=reel_id,
            user_id=g.current_user.id,
            watch_time=0
        )
        db.session.add(view)
        
        if reel.user_id != g.current_user.id:
            Reel.query.filter_by(id=reel_id).update({
                Reel.views_count: Reel.views_count + 1
            })

    data = request.get_json(silent=True) or {}
    view.watch_time = max(
        view.watch_time or 0,
        data.get("watch_time", 0)
    )
    view.completed = (
        view.completed or
        data.get("completed", False)
    )

    if "duration" in data and data.get("duration"):
        reel = db.session.get(Reel, reel_id)
        if reel:
            reel.duration = float(data["duration"])

    db.session.commit()

    return jsonify({
        "message": "Watch progress updated"
    })

@reel_bp.route("/feed", methods=["GET", "OPTIONS"])
@token_required
def get_reel_feed():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 6)), 1), 12)

    following_ids = [user.id for user in g.current_user.following.all()]
    feed_user_ids = following_ids + [g.current_user.id]

    # Filter out blocked/blocking users and hidden reels
    blocked_ids = [b.blocked_id for b in BlockedUser.query.filter_by(blocker_id=g.current_user.id).all()]
    blocker_ids = [b.blocker_id for b in BlockedUser.query.filter_by(blocked_id=g.current_user.id).all()]
    exclude_user_ids = set(blocked_ids + blocker_ids)

    hidden_reel_ids = [h.reel_id for h in HiddenContent.query.filter_by(user_id=g.current_user.id).filter(HiddenContent.reel_id.isnot(None)).all()]

    query = Reel.query
    if exclude_user_ids:
        query = query.filter(~Reel.user_id.in_(exclude_user_ids))
    if hidden_reel_ids:
        query = query.filter(~Reel.id.in_(hidden_reel_ids))

    if feed_user_ids:
        # Keep feed limited to following and self, but exclude blocked/hidden
        query_filtered = query.filter(Reel.user_id.in_(feed_user_ids))
        if query_filtered.count() > 0:
            query = query_filtered
        else:
            # Fallback to general public feed
            query = query.join(User, Reel.user_id == User.id).filter(
                or_(User.is_private.is_(False), User.id.in_(feed_user_ids))
            )
            if exclude_user_ids:
                query = query.filter(~Reel.user_id.in_(exclude_user_ids))
            if hidden_reel_ids:
                query = query.filter(~Reel.id.in_(hidden_reel_ids))
    else:
        query = query.join(User, Reel.user_id == User.id).filter(
            or_(User.is_private.is_(False), User.id.in_(feed_user_ids))
        )
        if exclude_user_ids:
            query = query.filter(~Reel.user_id.in_(exclude_user_ids))
        if hidden_reel_ids:
            query = query.filter(~Reel.id.in_(hidden_reel_ids))

    pagination = query.order_by(Reel.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "reels": [reel.to_dict(current_user_id=g.current_user.id) for reel in pagination.items],
        "page": page,
        "per_page": per_page,
        "total": pagination.total,
        "has_next": pagination.has_next,
    })

@reel_bp.route("/user/<int:user_id>", methods=["GET", "OPTIONS"])
@token_required
def get_user_reels(user_id):
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 9)), 1), 18)

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    # Privacy check
    if user.is_private and user.id != g.current_user.id:
        is_following = user.followers.filter(User.id == g.current_user.id).count() > 0
        if not is_following:
            return jsonify({"reels": [], "message": "This account is private."}), 403

    pagination = Reel.query.filter_by(user_id=user_id).order_by(Reel.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "reels": [reel.to_dict(current_user_id=g.current_user.id) for reel in pagination.items],
        "page": page,
        "per_page": per_page,
        "total": pagination.total,
        "has_next": pagination.has_next,
    })

@reel_bp.route("/<int:reel_id>", methods=["DELETE", "OPTIONS"])
@token_required
def delete_reel(reel_id):
    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404

    if reel.user_id != g.current_user.id:
        return jsonify({"message": "You are not authorized to delete this reel."}), 403

    try:
        if reel.cloudinary_public_id:
            delete_video_from_cloudinary(reel.cloudinary_public_id)
        else:
            # Fallback for old local reels
            delete_video(reel.video_path)
            delete_video(reel.thumbnail_path)

        db.session.delete(reel)
        db.session.commit()
        return jsonify({"message": "Reel deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Delete failed: {str(e)}"}), 500


@reel_bp.post("/like/<int:reel_id>")
@limiter.limit("60 per minute")
@token_required
def toggle_reel_like(reel_id):
    from routes.notification_routes import create_notification
    from utils.redis_service import RedisService

    # Redis-based Anti-Spam burst detection (limit: max 10 likes in 10 seconds)
    like_burst_count = RedisService.increment_spam_counter(g.current_user.id, "reel_like", window_seconds=10)
    if like_burst_count > 10:
        return jsonify({"message": "Suspicious rapid like activity detected. Slow down!"}), 429

    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404

    existing_like = g.current_user.liked_reels.filter(Reel.id == reel.id).first()
    if existing_like:
        g.current_user.liked_reels.remove(reel)
        liked = False
        message = "Reel unliked."
    else:
        g.current_user.liked_reels.append(reel)
        liked = True
        message = "Reel liked."
        create_notification(
            user_id=reel.user_id,
            actor_id=g.current_user.id,
            type_="reel_like",
            target_type="reel",
            target_id=reel.id,
        )

    db.session.commit()

    return jsonify(
        {
            "message": message,
            "liked": liked,
            "likes_count": reel.liked_by.count(),
        }
    )


@reel_bp.post("/repost/<int:reel_id>")
@token_required
def toggle_reel_repost(reel_id):
    from routes.notification_routes import create_notification

    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404

    existing_repost = g.current_user.reposted_reels.filter(Reel.id == reel.id).first()
    if existing_repost:
        g.current_user.reposted_reels.remove(reel)
        reposted = False
        message = "Reel removed from reposts."
    else:
        g.current_user.reposted_reels.append(reel)
        reposted = True
        message = "Reel reposted."
        create_notification(
            user_id=reel.user_id,
            actor_id=g.current_user.id,
            type_="repost",
            target_type="reel",
            target_id=reel.id,
        )

    db.session.commit()

    return jsonify(
        {
            "message": message,
            "reposted": reposted,
            "reposts_count": reel.reposted_by.count(),
        }
    )
    
@reel_bp.get("/recommended")
@token_required
def get_recommended_reels():
    import time
    import json
    import logging
    from ml.recommender import recommend_reels_for_user, RecommenderCache
    
    limit = min(max(int(request.args.get("limit", 6)), 1), 12)
    
    # 1. Engine Execution (Includes DB loading and math ranking)
    t0 = time.perf_counter()
    recommended_reels = recommend_reels_for_user(g.current_user, limit=limit)
    engine_ms = (time.perf_counter() - t0) * 1000
    
    # 2. Payload Serialization Execution
    t1 = time.perf_counter()
    serialized_reels = [reel.to_dict(current_user_id=g.current_user.id) for reel in recommended_reels]
    serialization_ms = (time.perf_counter() - t1) * 1000
    
    # Extract DB and Ranking components
    profile = getattr(RecommenderCache, "latest_profile", {})
    db_ms = profile.get("db_ms", 0.0)
    ranking_ms = profile.get("ranking_ms", 0.0)
    
    # Standardize profile
    profile_log = {
        "db_ms": round(db_ms, 2),
        "ranking_ms": round(ranking_ms, 2),
        "serialization_ms": round(serialization_ms, 2),
        "total_ms": round(engine_ms + serialization_ms, 2)
    }
    
    # Log structured latency profile as requested
    logger = logging.getLogger("neurality")
    logger.info(f"[LATENCY_PROFILE] {json.dumps(profile_log)}")
    
    # 3. Trigger Async Background Prewarming for the next feed refresh (Priority 5)
    from flask import current_app
    from utils.prewarm_service import prewarm_user_feed
    prewarm_user_feed(g.current_user.id, current_app._get_current_object())
    
    return jsonify({
        "reels": serialized_reels,
        "latency_profile": profile_log
    })

@reel_bp.get("/trending")
@token_required
def get_trending_reels():
    from utils.redis_service import RedisService

    # Try fetching cached trending reel IDs
    cached_ids = RedisService.get("neurality:trending_reel_ids")
    if cached_ids:
        # Load the Reels corresponding to these IDs and preserve the exact order
        reels_map = {reel.id: reel for reel in Reel.query.filter(Reel.id.in_(cached_ids)).all()}
        sorted_reels = [reels_map[rid] for rid in cached_ids if rid in reels_map]
    else:
        reels = Reel.query.order_by(
            Reel.views_count.desc(),
            Reel.created_at.desc()
        ).limit(30).all()

        sorted_reels = sorted(
            reels,
            key=lambda r: r.calculate_trending_score(),
            reverse=True
        )
        
        # Cache the sorted IDs for 120 seconds (2 minutes)
        sorted_ids = [r.id for r in sorted_reels]
        RedisService.set("neurality:trending_reel_ids", sorted_ids, ttl=120)

    return jsonify({
        "reels": [
            reel.to_dict(current_user_id=g.current_user.id)
            for reel in sorted_reels
        ]
    })


@reel_bp.post("/save/<int:reel_id>")
@token_required
def toggle_reel_save(reel_id):
    from models.social import SavedPost
    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404

    existing = SavedPost.query.filter_by(user_id=g.current_user.id, reel_id=reel_id).first()
    if existing:
        reel.saves_count = max((reel.saves_count or 0) - 1, 0)
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"message": "Reel unsaved.", "saved": False})
    else:
        saved = SavedPost(user_id=g.current_user.id, reel_id=reel_id)
        reel.saves_count += 1
        db.session.add(saved)
        db.session.commit()
        return jsonify({"message": "Reel saved.", "saved": True})


@reel_bp.get("/<int:reel_id>")
@token_required
def get_reel(reel_id):
    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404
    return jsonify({"reel": reel.to_dict(current_user_id=g.current_user.id)})
