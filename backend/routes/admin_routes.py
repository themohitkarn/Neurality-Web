from flask import Blueprint, g, jsonify, request

from extensions import db
from models.post import Post
from models.reel import Reel
from models.social import Report, BlockedUser
from models.user import User
from utils.jwt_helper import token_required


admin_bp = Blueprint("admin", __name__)
admin_bp.strict_slashes = False


def admin_required(f):
    """Decorator that checks if the current user is an admin."""
    from functools import wraps

    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if not g.current_user.is_admin:
            return jsonify({"message": "Admin access required."}), 403
        return f(*args, **kwargs)

    return decorated


# ─── Dashboard Overview ───

@admin_bp.get("/dashboard")
@admin_required
def dashboard():
    total_users = User.query.count()
    total_posts = Post.query.count()
    total_reels = Reel.query.count()
    pending_reports = Report.query.filter_by(status="pending").count()
    total_reports = Report.query.count()

    return jsonify({
        "stats": {
            "total_users": total_users,
            "total_posts": total_posts,
            "total_reels": total_reels,
            "pending_reports": pending_reports,
            "total_reports": total_reports,
        }
    })


# ─── User Management ───

@admin_bp.get("/users")
@admin_required
def list_users():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 50)
    search = request.args.get("q", "").strip()

    query = User.query
    if search:
        query = query.filter(
            User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )

    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    users = []
    for u in pagination.items:
        users.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name or "",
            "is_verified": u.is_verified,
            "is_admin": u.is_admin,
            "is_private": u.is_private,
            "account_type": u.account_type,
            "posts_count": u.posts.count(),
            "followers_count": u.followers.count(),
            "created_at": u.created_at.isoformat(),
        })

    return jsonify({
        "users": users,
        "page": page,
        "total": pagination.total,
        "has_next": pagination.has_next,
    })


@admin_bp.post("/users/<int:user_id>/verify")
@admin_required
def toggle_verify(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    user.is_verified = not user.is_verified
    db.session.commit()
    return jsonify({
        "message": f"{'Verified' if user.is_verified else 'Unverified'} {user.username}.",
        "is_verified": user.is_verified,
    })


@admin_bp.post("/users/<int:user_id>/ban")
@admin_required
def ban_user(user_id):
    """Soft-ban: set account_type to 'banned'."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404
    if user.id == g.current_user.id:
        return jsonify({"message": "You cannot ban yourself."}), 400

    if user.account_type == "banned":
        user.account_type = "personal"
        action = "unbanned"
    else:
        user.account_type = "banned"
        action = "banned"

    db.session.commit()
    return jsonify({"message": f"User {user.username} {action}.", "account_type": user.account_type})


@admin_bp.post("/users/<int:user_id>/make-admin")
@admin_required
def toggle_admin(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    user.is_admin = not user.is_admin
    db.session.commit()
    return jsonify({
        "message": f"{'Promoted' if user.is_admin else 'Demoted'} {user.username}.",
        "is_admin": user.is_admin,
    })


# ─── Report Management ───

@admin_bp.get("/reports")
@admin_required
def list_reports():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 50)
    status_filter = request.args.get("status")

    query = Report.query
    if status_filter:
        query = query.filter_by(status=status_filter)

    pagination = query.order_by(Report.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "reports": [r.to_dict() for r in pagination.items],
        "page": page,
        "total": pagination.total,
        "has_next": pagination.has_next,
    })


@admin_bp.post("/reports/<int:report_id>/resolve")
@admin_required
def resolve_report(report_id):
    from datetime import datetime

    report = db.session.get(Report, report_id)
    if not report:
        return jsonify({"message": "Report not found."}), 404

    data = request.get_json(silent=True) or {}
    action = data.get("action", "resolved")  # resolved or dismissed

    report.status = action
    report.reviewed_by = g.current_user.id
    report.resolved_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": f"Report {action}.", "report": report.to_dict()})


# ─── Content Moderation ───

@admin_bp.delete("/posts/<int:post_id>")
@admin_required
def delete_post(post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found."}), 404

    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted by admin."})


@admin_bp.delete("/reels/<int:reel_id>")
@admin_required
def delete_reel(reel_id):
    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404

    db.session.delete(reel)
    db.session.commit()
    return jsonify({"message": "Reel deleted by admin."})
