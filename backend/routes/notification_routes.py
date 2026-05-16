from flask import Blueprint, g, jsonify, request

from extensions import db
from models.social import Notification
from utils.jwt_helper import token_required


notification_bp = Blueprint("notifications", __name__)
notification_bp.strict_slashes = False


def create_notification(user_id, actor_id, type_, target_type=None, target_id=None, body=None):
    """Helper to create and store a notification. Skips if actor == recipient."""
    if user_id == actor_id:
        return None

    notification = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=type_,
        target_type=target_type,
        target_id=target_id,
        body=body,
    )
    db.session.add(notification)
    return notification


@notification_bp.get("/")
@token_required
def get_notifications():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 50)

    unread_count = Notification.query.filter_by(user_id=g.current_user.id, is_read=False).count()

    pagination = (
        Notification.query
        .filter_by(user_id=g.current_user.id)
        .order_by(Notification.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "notifications": [n.to_dict() for n in pagination.items],
        "unread_count": unread_count,
        "page": page,
        "has_next": pagination.has_next,
    })


@notification_bp.post("/read")
@token_required
def mark_as_read():
    """Mark specific notifications or all as read."""
    data = request.get_json(silent=True) or {}
    notification_ids = data.get("ids")

    query = Notification.query.filter_by(user_id=g.current_user.id, is_read=False)

    if notification_ids:
        query = query.filter(Notification.id.in_(notification_ids))

    count = query.update({"is_read": True}, synchronize_session=False)
    db.session.commit()

    return jsonify({"message": f"Marked {count} notifications as read.", "count": count})


@notification_bp.get("/unread-count")
@token_required
def unread_count():
    count = Notification.query.filter_by(user_id=g.current_user.id, is_read=False).count()
    return jsonify({"unread_count": count})

@notification_bp.post("/internal/send-push")
def internal_send_push():
    # Security check: in production, use a shared secret key in headers
    # For now, we trust the internal network
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    title = data.get("title")
    body = data.get("body")
    type_ = data.get("type")
    
    from models import User
    from utils.notifications import send_push_notification
    
    user = db.session.get(User, user_id)
    if user and user.fcm_token:
        send_push_notification(
            user.fcm_token, 
            title, 
            body, 
            data={"type": type_}
        )
        return jsonify({"success": True})
        
    return jsonify({"success": False, "reason": "User not found or no token"}), 404
