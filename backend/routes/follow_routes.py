from flask import Blueprint, g, jsonify, request

from extensions import db, limiter
from models.user import User
from utils.follow_rules import (
    FOLLOW_REQUEST_ACCEPTED,
    FOLLOW_REQUEST_REJECTED,
    create_or_refresh_follow_request,
    follow_user,
    get_follow_access_state,
    list_follow_requests_for_user,
    respond_to_follow_request,
    unfollow_user,
)
from utils.jwt_helper import token_required


follow_bp = Blueprint("follow", __name__)
relationship_bp = Blueprint("relationship", __name__)


@follow_bp.post("/request")
@token_required
def create_follow_request():
    payload = request.get_json(silent=True) or {}
    receiver_id = payload.get("receiver_id")

    if not receiver_id:
        return jsonify({"message": "receiver_id is required."}), 400

    receiver = db.session.get(User, receiver_id)
    if not receiver or receiver.id == g.current_user.id:
        return jsonify({"message": "Choose a valid recipient."}), 400

    try:
        follow_request, created = create_or_refresh_follow_request(g.current_user, receiver)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if created:
        db.session.add(follow_request)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Follow request sent." if created else "Follow request sent again.",
                "request": follow_request.to_dict(current_user_id=g.current_user.id),
                "followers_count": receiver.followers.count(),
            }
        ),
        201 if created else 200,
    )


@follow_bp.get("/requests")
@token_required
def get_follow_requests():
    incoming, outgoing = list_follow_requests_for_user(g.current_user.id)
    return jsonify(
        {
            "incoming": [item.to_dict(current_user_id=g.current_user.id) for item in incoming],
            "outgoing": [item.to_dict(current_user_id=g.current_user.id) for item in outgoing],
        }
    )


def _handle_follow_request_response(action):
    payload = request.get_json(silent=True) or {}
    request_id = payload.get("request_id")

    if not request_id:
        return jsonify({"message": "request_id is required."}), 400

    try:
        follow_request = respond_to_follow_request(g.current_user, request_id, action)
        db.session.commit()
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except LookupError as exc:
        return jsonify({"message": str(exc)}), 404
    except PermissionError as exc:
        return jsonify({"message": str(exc)}), 403
    except RuntimeError as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify(
        {
            "message": "Follow request accepted."
            if action == FOLLOW_REQUEST_ACCEPTED
            else "Follow request rejected.",
            "request": follow_request.to_dict(current_user_id=g.current_user.id),
            "followers_count": g.current_user.followers.count(),
        }
    )


@follow_bp.post("/accept")
@token_required
def accept_follow_request():
    return _handle_follow_request_response(FOLLOW_REQUEST_ACCEPTED)


@follow_bp.post("/reject")
@token_required
def reject_follow_request():
    return _handle_follow_request_response(FOLLOW_REQUEST_REJECTED)


def _follow_target_or_404(user_id):
    target_user = db.session.get(User, user_id)
    if not target_user:
        return None, (jsonify({"message": "User not found."}), 404)
    if target_user.id == g.current_user.id:
        return None, (jsonify({"message": "You cannot follow yourself."}), 400)
    return target_user, None


def _follow_state_payload(target_user, result):
    access_state = get_follow_access_state(g.current_user, target_user)
    return {
        "message": result["message"],
        "following": result["following"],
        "follow_requested": result["follow_requested"],
        "follow_request_status": access_state["follow_request_status"],
        "follow_request_direction": access_state["follow_request_direction"],
        "follow_request_id": access_state["follow_request_id"],
        "followers_count": target_user.followers.count(),
        "following_count": target_user.following.count(),
    }


@relationship_bp.post("/follow/<int:user_id>")
@limiter.limit("30 per minute")
@token_required
def follow_user_route(user_id):
    from routes.notification_routes import create_notification
    from utils.redis_service import RedisService

    # Redis-based Anti-Spam burst detection (limit: max 5 follows in 10 seconds)
    follow_burst_count = RedisService.increment_spam_counter(g.current_user.id, "follow", window_seconds=10)
    if follow_burst_count > 5:
        return jsonify({"message": "Suspicious rapid follow activity detected. Slow down!"}), 429

    target_user, error_response = _follow_target_or_404(user_id)
    if error_response:
        return error_response

    try:
        result = follow_user(g.current_user, target_user)
        if result.get("following"):
            create_notification(
                user_id=target_user.id,
                actor_id=g.current_user.id,
                type_="follow",
            )
        elif result.get("follow_requested"):
            create_notification(
                user_id=target_user.id,
                actor_id=g.current_user.id,
                type_="follow_request",
            )
        db.session.commit()
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify(_follow_state_payload(target_user, result))


@relationship_bp.post("/unfollow/<int:user_id>")
@limiter.limit("30 per minute")
@token_required
def unfollow_user_route(user_id):
    target_user, error_response = _follow_target_or_404(user_id)
    if error_response:
        return error_response

    result = unfollow_user(g.current_user, target_user)
    db.session.commit()
    return jsonify(_follow_state_payload(target_user, result))


@relationship_bp.get("/search-users")
@token_required
def search_users():
    from sqlalchemy import func, or_
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"users": []})

    # Search by username or full name, case insensitive, partial match
    users = (
        User.query.filter(
            or_(
                func.lower(User.username).like(f"%{query.lower()}%"),
                func.lower(func.coalesce(User.full_name, "")).like(f"%{query.lower()}%"),
            )
        )
        .order_by(User.username.asc())
        .limit(20)
        .all()
    )
    
    return jsonify({
        "users": [user.to_dict(viewer_id=g.current_user.id, include_email=False) for user in users]
    })
