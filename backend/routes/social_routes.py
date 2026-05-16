from flask import Blueprint, g, jsonify, request

from extensions import db
from models.post import Post
from models.social import BlockedUser, PinnedPost, Report, SavedPost
from models.user import User
from utils.jwt_helper import token_required


social_bp = Blueprint("social", __name__)
social_bp.strict_slashes = False


# ─── Save/Bookmark Posts ───


@social_bp.post("/posts/<int:post_id>/save")
@token_required
def toggle_save_post(post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found."}), 404

    existing = SavedPost.query.filter_by(user_id=g.current_user.id, post_id=post_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"message": "Post unsaved.", "saved": False})
    else:
        saved = SavedPost(user_id=g.current_user.id, post_id=post_id)
        db.session.add(saved)
        db.session.commit()
        return jsonify({"message": "Post saved.", "saved": True})


@social_bp.get("/saved")
@token_required
def get_saved_posts():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 12)), 1), 30)

    pagination = (
        SavedPost.query.filter_by(user_id=g.current_user.id)
        .order_by(SavedPost.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    posts = [sp.post.to_dict(current_user_id=g.current_user.id) for sp in pagination.items if sp.post]
    return jsonify({"posts": posts, "page": page, "has_next": pagination.has_next})


# ─── Pin Posts ───


@social_bp.post("/posts/<int:post_id>/pin")
@token_required
def toggle_pin_post(post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found."}), 404
    if post.user_id != g.current_user.id:
        return jsonify({"message": "You can only pin your own posts."}), 403

    existing = PinnedPost.query.filter_by(user_id=g.current_user.id, post_id=post_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"message": "Post unpinned.", "pinned": False})

    # Limit to 3 pinned posts
    pinned_count = PinnedPost.query.filter_by(user_id=g.current_user.id).count()
    if pinned_count >= 3:
        return jsonify({"message": "You can only pin up to 3 posts."}), 400

    pinned = PinnedPost(user_id=g.current_user.id, post_id=post_id, position=pinned_count)
    db.session.add(pinned)
    db.session.commit()
    return jsonify({"message": "Post pinned.", "pinned": True})


# ─── Block/Unblock Users ───


@social_bp.post("/users/<int:user_id>/block")
@token_required
def toggle_block(user_id):
    if user_id == g.current_user.id:
        return jsonify({"message": "You cannot block yourself."}), 400

    target = db.session.get(User, user_id)
    if not target:
        return jsonify({"message": "User not found."}), 404

    existing = BlockedUser.query.filter_by(blocker_id=g.current_user.id, blocked_id=user_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"message": f"Unblocked {target.username}.", "blocked": False})
    else:
        block = BlockedUser(blocker_id=g.current_user.id, blocked_id=user_id)
        db.session.add(block)

        # Also unfollow each other
        if target in g.current_user.following.all():
            g.current_user.following.remove(target)
        if g.current_user in target.following.all():
            target.following.remove(g.current_user)

        db.session.commit()
        return jsonify({"message": f"Blocked {target.username}.", "blocked": True})


@social_bp.get("/blocked")
@token_required
def list_blocked():
    blocked = BlockedUser.query.filter_by(blocker_id=g.current_user.id).all()
    users = []
    for b in blocked:
        from utils.image_handler import build_media_url
        users.append({
            "id": b.blocked.id,
            "username": b.blocked.username,
            "profile_pic": build_media_url(b.blocked.profile_pic),
        })
    return jsonify({"blocked_users": users})


# ─── Report System ───


@social_bp.post("/report")
@token_required
def create_report():
    data = request.get_json(silent=True) or {}
    target_type = data.get("target_type")
    target_id = data.get("target_id")
    reason = data.get("reason")

    if not all([target_type, target_id, reason]):
        return jsonify({"message": "target_type, target_id, and reason are required."}), 400

    valid_types = {"user", "post", "reel", "story", "comment", "message"}
    if target_type not in valid_types:
        return jsonify({"message": f"target_type must be one of: {', '.join(valid_types)}"}), 400

    report = Report(
        reporter_id=g.current_user.id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        description=data.get("description", ""),
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({"message": "Report submitted. We'll review it shortly.", "report_id": report.id}), 201

