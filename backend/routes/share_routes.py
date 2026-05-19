from datetime import datetime

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_, and_

from extensions import db, socketio
from models.user import User
from models.post import Post
from models.reel import Reel
from utils.jwt_helper import token_required
# from routes.chat_routes import _room_name, _serialize_chat_user # Deprecated

# DEPRECATED: This blueprint is partially legacy.
# The 'send-share' logic has been migrated to the Node.js realtime-server (/api/chat/share).
# User search and social discovery routes currently remain here as part of the Social Graph.

share_bp = Blueprint("share", __name__)


@share_bp.get("/search-users")
@token_required
def search_users():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"users": []})

    from models.social import BlockedUser
    blocks = BlockedUser.query.filter(
        or_(BlockedUser.blocker_id == g.current_user.id, BlockedUser.blocked_id == g.current_user.id)
    ).all()
    blocked_ids = {b.blocker_id for b in blocks} | {b.blocked_id for b in blocks}
    blocked_ids.add(g.current_user.id)

    users = (
        User.query.filter(
            ~User.id.in_(blocked_ids),
            or_(
                func.lower(User.username).like(f"%{query.lower()}%"),
                func.lower(func.coalesce(User.full_name, "")).like(f"%{query.lower()}%"),
            )
        )
        .order_by(User.verified.desc(), User.username.asc())
        .limit(10)
        .all()
    )
    return jsonify({"users": [user.to_dict(viewer_id=g.current_user.id, include_email=False) for user in users]})


@share_bp.get("/recent-chats")
@token_required
def recent_chats():
    # Use existing chat access logic to get users with conversations
    users = User.query.filter(User.id != g.current_user.id).all()
    payload = []
    for user in users:
        serialized = _serialize_chat_user(user)
        if serialized["has_conversation"]:
            payload.append(serialized)
            
    payload.sort(key=lambda item: (item["last_message_at"] or ""), reverse=True)
    return jsonify({"users": payload[:15]})


@share_bp.get("/following")
@token_required
def following_users():
    following = g.current_user.following.order_by(User.username.asc()).limit(20).all()
    return jsonify({"users": [user.to_dict(viewer_id=g.current_user.id, include_email=False) for user in following]})


@share_bp.get("/suggested-users")
@token_required
def suggested_users():
    from models.social import BlockedUser
    blocks = BlockedUser.query.filter(
        or_(BlockedUser.blocker_id == g.current_user.id, BlockedUser.blocked_id == g.current_user.id)
    ).all()
    blocked_ids = {b.blocker_id for b in blocks} | {b.blocked_id for b in blocks}
    blocked_ids.add(g.current_user.id)

    # Users not followed by current user
    following_ids = [u.id for u in g.current_user.following.all()]
    excluded_ids = blocked_ids | set(following_ids)
    
    suggested = (
        User.query.filter(~User.id.in_(excluded_ids))
        .order_by(func.random())
        .limit(10)
        .all()
    )
    return jsonify({"users": [user.to_dict(viewer_id=g.current_user.id, include_email=False) for user in suggested]})


@share_bp.post("/send-share")
@token_required
def send_share():
    return jsonify({
        "message": "This endpoint is deprecated. Please use the Node.js realtime-server sharing endpoint.",
        "status": "moved_permanently"
    }), 410 # Gone / Moved
