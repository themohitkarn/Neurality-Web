import re

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_

from extensions import db
from models.post import Post
from models.user import User
from utils.follow_rules import (
    FOLLOW_REQUEST_ACCEPTED,
    FOLLOW_REQUEST_REJECTED,
    get_follow_access_state,
    list_follow_requests_for_user,
    toggle_follow_user,
    respond_to_follow_request as apply_follow_request_response,
)
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import get_current_user_optional, token_required


user_bp = Blueprint("users", __name__)
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_THEME_PREFERENCES = {"system", "light", "dark"}
ALLOWED_ACCOUNT_TYPES = {"personal", "professional", "creator"}


def _get_payload():
    return request.form if request.form else (request.get_json(silent=True) or {})


def _bool_value(value, default=False):
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)

    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False
    return default


def _normalize_website(value):
    website = (value or "").strip()
    if not website:
        return None
    if not re.match(r"^https?://", website, re.IGNORECASE):
        website = f"https://{website}"
    return website


def _attach_follow_access(data, viewer, target):
    if not viewer or not target or viewer.id == target.id:
        data["follow_request_status"] = None
        data["follow_request_direction"] = None
        data["follow_request_id"] = None
        data["can_follow_directly"] = False
        data["can_request_follow"] = False
        return data

    follow_access = get_follow_access_state(viewer, target)
    data["follow_request_status"] = follow_access["follow_request_status"]
    data["follow_request_direction"] = follow_access["follow_request_direction"]
    data["follow_request_id"] = follow_access["follow_request_id"]
    data["can_follow_directly"] = follow_access["can_follow_directly"]
    data["can_request_follow"] = follow_access["can_request_follow"]
    return data


@user_bp.get("/search")
def search_users():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"users": []})

    viewer = get_current_user_optional()
    viewer_id = viewer.id if viewer else None
    
    blocked_ids = set()
    if viewer:
        from models.social import BlockedUser
        blocks = BlockedUser.query.filter(
            or_(BlockedUser.blocker_id == viewer.id, BlockedUser.blocked_id == viewer.id)
        ).all()
        for b in blocks:
            blocked_ids.add(b.blocker_id)
            blocked_ids.add(b.blocked_id)
        blocked_ids.discard(viewer.id)

    query_obj = User.query.filter(
        or_(
            func.lower(User.username).like(f"%{query.lower()}%"),
            func.lower(func.coalesce(User.full_name, "")).like(f"%{query.lower()}%"),
        )
    )
    
    if blocked_ids:
        query_obj = query_obj.filter(~User.id.in_(blocked_ids))

    users = query_obj.order_by(User.username.asc()).limit(8).all()
    
    return jsonify({"users": [user.to_dict(viewer_id=viewer_id, include_email=False) for user in users]})


@user_bp.get("/<int:user_id>")
def get_user_profile(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    viewer = get_current_user_optional()
    viewer_id = viewer.id if viewer else None
    
    is_blocked_by_viewer = False
    is_blocked_by_target = False
    
    if viewer:
        from models.social import BlockedUser
        is_blocked_by_viewer = BlockedUser.query.filter_by(blocker_id=viewer.id, blocked_id=user.id).first() is not None
        is_blocked_by_target = BlockedUser.query.filter_by(blocker_id=user.id, blocked_id=viewer.id).first() is not None
        
        if is_blocked_by_viewer or is_blocked_by_target:
            return jsonify({"message": "User not found."}), 404

    data = user.to_dict(viewer_id=viewer_id, include_email=viewer_id == user.id, include_posts=True)
    
    if viewer:
        data = _attach_follow_access(data, viewer, user)
        
    data["is_blocked"] = False
    data["blocked_by_them"] = False

    if not data.get("requires_follow"):
        data["posts"] = [
            post.to_dict(current_user_id=viewer_id, include_comments=True)
            for post in Post.query.filter_by(user_id=user.id).order_by(Post.created_at.desc()).all()
        ]
    return jsonify({"user": data})


@user_bp.get("/<int:user_id>/connections")
@token_required
def get_user_connections(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    relation_type = (request.args.get("type") or "followers").strip().lower()
    if relation_type not in {"followers", "following"}:
        return jsonify({"message": "type must be followers or following."}), 400

    if user.is_private and user.id != g.current_user.id and not user.is_followed_by(g.current_user.id):
        return jsonify({"message": "Follow this user to view their social graph."}), 403

    relation_query = user.followers if relation_type == "followers" else user.following
    related_users = relation_query.order_by(User.username.asc()).all()

    return jsonify(
        {
            "type": relation_type,
            "users": [item.to_dict(viewer_id=g.current_user.id, include_email=False) for item in related_users],
        }
    )


@user_bp.get("/me")
@token_required
def get_current_profile():
    return jsonify(
        {
            "user": g.current_user.to_dict(
                viewer_id=g.current_user.id,
                include_email=True,
                include_posts=True,
                include_settings=True,
            )
        }
    )


@user_bp.put("/me")
@token_required
def update_current_profile():
    payload = _get_payload()
    username = (payload.get("username") or g.current_user.username or "").strip()
    email = (payload.get("email") or g.current_user.email or "").strip().lower()
    full_name = (payload.get("full_name") or "").strip()
    bio = (payload.get("bio") or "").strip()
    website = _normalize_website(payload.get("website"))
    location = (payload.get("location") or "").strip()
    remove_profile_pic = _bool_value(payload.get("remove_profile_pic"), default=False)

    if not username:
        return jsonify({"message": "Username is required."}), 400

    if len(username) < 3 or len(username) > 50:
        return jsonify({"message": "Username must be between 3 and 50 characters."}), 400

    if not email or not EMAIL_REGEX.match(email):
        return jsonify({"message": "Please provide a valid email address."}), 400

    if len(full_name) > 120:
        return jsonify({"message": "Full name must be 120 characters or fewer."}), 400

    if len(bio) > 255:
        return jsonify({"message": "Bio must be 255 characters or fewer."}), 400

    if location and len(location) > 120:
        return jsonify({"message": "Location must be 120 characters or fewer."}), 400

    conflicting_user = User.query.filter(
        or_(func.lower(User.username) == username.lower(), func.lower(User.email) == email),
        User.id != g.current_user.id,
    ).first()
    if conflicting_user:
        return jsonify({"message": "That username or email is already in use."}), 409

    old_profile_pic = g.current_user.profile_pic
    new_profile_pic = None

    if "profile_pic" in request.files and request.files["profile_pic"].filename:
        try:
            new_profile_pic = save_uploaded_image(request.files["profile_pic"], category="avatars")
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400

    if remove_profile_pic:
        g.current_user.profile_pic = None

    if new_profile_pic:
        g.current_user.profile_pic = new_profile_pic

    g.current_user.username = username
    g.current_user.email = email
    g.current_user.full_name = full_name or None
    g.current_user.bio = bio or None
    g.current_user.website = website
    g.current_user.location = location or None

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        if new_profile_pic:
            delete_image(new_profile_pic)
        return jsonify({"message": f"Unable to update profile: {exc}"}), 500

    if new_profile_pic and old_profile_pic and old_profile_pic != new_profile_pic:
        delete_image(old_profile_pic)
    elif remove_profile_pic and old_profile_pic and not new_profile_pic:
        delete_image(old_profile_pic)

    return jsonify(
        {
            "message": "Profile updated successfully.",
            "user": g.current_user.to_dict(
                viewer_id=g.current_user.id,
                include_email=True,
                include_settings=True,
            ),
        }
    )


@user_bp.get("/settings")
@token_required
def get_settings():
    return jsonify(
        {
            "user": g.current_user.to_dict(
                viewer_id=g.current_user.id,
                include_email=True,
                include_settings=True,
            )
        }
    )


@user_bp.post("/fcm-token")
@token_required
def register_fcm_token():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token")
    if not token:
        return jsonify({"message": "Token is required."}), 400
    
    g.current_user.fcm_token = token
    db.session.commit()
    return jsonify({"message": "Token saved successfully."}), 200


@user_bp.put("/settings")
@token_required
def update_settings():
    payload = request.get_json(silent=True) or {}
    theme_preference = (payload.get("theme_preference") or g.current_user.theme_preference or "system").strip().lower()
    account_type = (payload.get("account_type") or g.current_user.account_type or "personal").strip().lower()
    
    ALLOWED_THEMES = {"system", "light", "dark", "amoled", "custom"}
    if theme_preference not in ALLOWED_THEMES:
        return jsonify({"message": "Theme preference must be system, light, dark, amoled, or custom."}), 400
    if account_type not in ALLOWED_ACCOUNT_TYPES:
        return jsonify({"message": "Account type must be personal, professional, or creator."}), 400

    g.current_user.theme_preference = theme_preference
    g.current_user.is_private = _bool_value(payload.get("is_private"), default=g.current_user.is_private)
    g.current_user.account_type = account_type
    g.current_user.allow_message_requests = _bool_value(
        payload.get("allow_message_requests"),
        default=g.current_user.allow_message_requests,
    )
    g.current_user.show_activity_status = _bool_value(
        payload.get("show_activity_status"),
        default=g.current_user.show_activity_status,
    )
    g.current_user.email_notifications = _bool_value(
        payload.get("email_notifications"),
        default=g.current_user.email_notifications,
    )
    g.current_user.push_notifications = _bool_value(
        payload.get("push_notifications"),
        default=g.current_user.push_notifications,
    )
    g.current_user.autoplay_reels = _bool_value(
        payload.get("autoplay_reels"),
        default=g.current_user.autoplay_reels,
    )
    g.current_user.reduce_data_usage = _bool_value(
        payload.get("reduce_data_usage"),
        default=g.current_user.reduce_data_usage,
    )
    g.current_user.read_receipts_enabled = _bool_value(
        payload.get("read_receipts_enabled"),
        default=g.current_user.read_receipts_enabled,
    )
    g.current_user.typing_indicators_enabled = _bool_value(
        payload.get("typing_indicators_enabled"),
        default=g.current_user.typing_indicators_enabled,
    )

    # Granular privacy controls
    allowed_privacy = {"everyone", "followers", "nobody"}
    allowed_story_privacy = {"everyone", "followers", "close_friends"}

    who_can_comment = (payload.get("who_can_comment") or "").strip().lower()
    if who_can_comment and who_can_comment in allowed_privacy:
        g.current_user.who_can_comment = who_can_comment

    who_can_tag = (payload.get("who_can_tag") or "").strip().lower()
    if who_can_tag and who_can_tag in allowed_privacy:
        g.current_user.who_can_tag = who_can_tag

    story_privacy = (payload.get("story_privacy") or "").strip().lower()
    if story_privacy and story_privacy in allowed_story_privacy:
        g.current_user.story_privacy = story_privacy

    # Dynamically persist any extra theme/ui/flag metadata into theme_metadata
    import json
    meta = {}
    if g.current_user.theme_metadata:
        try:
            meta = json.loads(g.current_user.theme_metadata)
        except Exception:
            pass

    model_columns = {
        "theme_preference", "is_private", "account_type", "allow_message_requests",
        "show_activity_status", "email_notifications", "push_notifications",
        "autoplay_reels", "reduce_data_usage", "read_receipts_enabled",
        "typing_indicators_enabled", "who_can_comment", "who_can_tag", "story_privacy"
    }

    for key, val in payload.items():
        if key not in model_columns:
            meta[key] = val

    g.current_user.theme_metadata = json.dumps(meta)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"message": f"Unable to update settings: {exc}"}), 500

    return jsonify(
        {
            "message": "Settings updated successfully.",
            "user": g.current_user.to_dict(
                viewer_id=g.current_user.id,
                include_email=True,
                include_settings=True,
            ),
        }
    )


@user_bp.post("/follow/<int:user_id>")
@token_required
def toggle_follow(user_id):
    user_to_follow = db.session.get(User, user_id)
    if not user_to_follow:
        return jsonify({"message": "User not found."}), 404

    if g.current_user.id == user_to_follow.id:
        return jsonify({"message": "You cannot follow yourself."}), 400

    try:
        result = toggle_follow_user(g.current_user, user_to_follow)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    db.session.commit()

    access_state = get_follow_access_state(g.current_user, user_to_follow)

    return jsonify(
        {
            "message": result["message"],
            "following": result["following"],
            "follow_requested": result["follow_requested"],
            "follow_request_status": access_state["follow_request_status"],
            "follow_request_direction": access_state["follow_request_direction"],
            "follow_request_id": access_state["follow_request_id"],
            "followers_count": user_to_follow.followers.count(),
            "following_count": user_to_follow.following.count(),
        }
    )


@user_bp.get("/follow-requests")
@token_required
def get_follow_requests():
    incoming, outgoing = list_follow_requests_for_user(g.current_user.id)

    return jsonify(
        {
            "incoming": [item.to_dict(current_user_id=g.current_user.id) for item in incoming],
            "outgoing": [item.to_dict(current_user_id=g.current_user.id) for item in outgoing],
        }
    )


@user_bp.post("/follow-requests/respond")
@token_required
def respond_to_follow_request():
    payload = request.get_json(silent=True) or {}
    request_id = payload.get("request_id")
    action = (payload.get("action") or FOLLOW_REQUEST_ACCEPTED).strip().lower()

    if not request_id:
        return jsonify({"message": "request_id is required."}), 400

    if action not in {FOLLOW_REQUEST_ACCEPTED, FOLLOW_REQUEST_REJECTED}:
        return jsonify({"message": "action must be accepted or rejected."}), 400

    try:
        follow_request = apply_follow_request_response(g.current_user, request_id, action)
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
            "message": "Follow request accepted." if action == FOLLOW_REQUEST_ACCEPTED else "Follow request rejected.",
            "request": follow_request.to_dict(current_user_id=g.current_user.id),
            "followers_count": g.current_user.followers.count(),
        }
    )
