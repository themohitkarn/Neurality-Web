from datetime import datetime

from sqlalchemy import and_, or_

from flask import Blueprint, g, jsonify, request

from extensions import db, socketio
from models.message import Message
from models.message_request import MessageRequest
from models.user import User
from utils.chat_rules import (
    REQUEST_ACCEPTED,
    REQUEST_PENDING,
    REQUEST_REJECTED,
    create_or_refresh_message_request,
    get_chat_access_state,
)
from utils.jwt_helper import token_required


chat_bp = Blueprint("chat", __name__)


def _chat_room_name(user_id):
    return f"user_{user_id}"


def _last_message_between(user_a_id, user_b_id):
    return (
        Message.query.filter(
            or_(
                and_(Message.sender_id == user_a_id, Message.receiver_id == user_b_id),
                and_(Message.sender_id == user_b_id, Message.receiver_id == user_a_id),
            )
        )
        .order_by(Message.created_at.desc())
        .first()
    )


def _serialize_chat_user(user):
    last_message = _last_message_between(g.current_user.id, user.id)
    access_state = get_chat_access_state(g.current_user, user)
    item = user.to_dict(viewer_id=g.current_user.id, include_email=False)
    item["last_message_preview"] = last_message.content if last_message else ""
    item["last_message_at"] = last_message.created_at.isoformat() if last_message else None
    item["has_conversation"] = last_message is not None
    item["can_message"] = access_state["can_message_directly"]
    item["can_send_message_request"] = access_state["can_send_message_request"]
    item["message_request_status"] = access_state["message_request_status"]
    item["message_request_direction"] = access_state["message_request_direction"]
    item["message_request_id"] = access_state["message_request_id"]
    item["message_gate_reason"] = access_state["message_gate_reason"]
    return item


def _emit_message_request_event(event_name, message_request):
    payload = message_request.to_dict()
    socketio.emit(event_name, payload, to=_chat_room_name(message_request.sender_id))
    socketio.emit(event_name, payload, to=_chat_room_name(message_request.receiver_id))


@chat_bp.get("/users")
@token_required
def get_chat_users():
    users = User.query.filter(User.id != g.current_user.id).order_by(User.username.asc()).all()
    payload = [_serialize_chat_user(user) for user in users]

    payload.sort(key=lambda item: ((item["last_message_at"] or ""), item["username"].lower()), reverse=True)

    return jsonify({"users": payload})


@chat_bp.get("/messages/<int:user_id>")
@token_required
def get_conversation(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    access_state = get_chat_access_state(g.current_user, user)
    messages = []
    if access_state["can_message_directly"]:
        messages = (
            Message.query.filter(
                or_(
                    and_(Message.sender_id == g.current_user.id, Message.receiver_id == user.id),
                    and_(Message.sender_id == user.id, Message.receiver_id == g.current_user.id),
                )
            )
            .order_by(Message.created_at.asc())
            .limit(200)
            .all()
        )

    payload_user = user.to_dict(viewer_id=g.current_user.id, include_email=False)
    payload_user["can_message"] = access_state["can_message_directly"]
    payload_user["can_send_message_request"] = access_state["can_send_message_request"]
    payload_user["message_request_status"] = access_state["message_request_status"]
    payload_user["message_request_direction"] = access_state["message_request_direction"]
    payload_user["message_request_id"] = access_state["message_request_id"]
    payload_user["message_gate_reason"] = access_state["message_gate_reason"]

    return jsonify(
        {
            "user": payload_user,
            "chat_access": access_state,
            "messages": [message.to_dict(current_user_id=g.current_user.id) for message in messages],
        }
    )


@chat_bp.get("/requests")
@token_required
def get_message_requests():
    incoming = (
        MessageRequest.query.filter_by(receiver_id=g.current_user.id, status=REQUEST_PENDING)
        .order_by(MessageRequest.created_at.desc())
        .all()
    )
    outgoing = (
        MessageRequest.query.filter_by(sender_id=g.current_user.id, status=REQUEST_PENDING)
        .order_by(MessageRequest.created_at.desc())
        .all()
    )

    return jsonify(
        {
            "incoming": [item.to_dict(current_user_id=g.current_user.id) for item in incoming],
            "outgoing": [item.to_dict(current_user_id=g.current_user.id) for item in outgoing],
        }
    )


@chat_bp.post("/request")
@token_required
def create_message_request():
    payload = request.get_json(silent=True) or {}
    receiver_id = payload.get("receiver_id")

    if not receiver_id:
        return jsonify({"message": "receiver_id is required."}), 400

    receiver = db.session.get(User, receiver_id)
    if not receiver or receiver.id == g.current_user.id:
        return jsonify({"message": "Choose a valid recipient."}), 400

    try:
        message_request, created = create_or_refresh_message_request(g.current_user, receiver)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    _emit_message_request_event("message_request_created", message_request)

    return (
        jsonify(
            {
                "message": "Message request sent." if created else "Message request sent again.",
                "request": message_request.to_dict(current_user_id=g.current_user.id),
                "chat_access": get_chat_access_state(g.current_user, receiver),
            }
        ),
        201 if created else 200,
    )


def _respond_to_message_request(action):
    payload = request.get_json(silent=True) or {}
    request_id = payload.get("request_id")

    if not request_id:
        return jsonify({"message": "request_id is required."}), 400

    message_request = db.session.get(MessageRequest, request_id)
    if not message_request:
        return jsonify({"message": "Message request not found."}), 404

    if message_request.receiver_id != g.current_user.id:
        return jsonify({"message": "You cannot respond to this message request."}), 403

    if message_request.status != REQUEST_PENDING:
        return jsonify({"message": "This message request has already been handled."}), 400

    message_request.status = action
    message_request.responded_at = datetime.utcnow()
    db.session.commit()
    _emit_message_request_event("message_request_updated", message_request)

    sender = db.session.get(User, message_request.sender_id)

    return jsonify(
        {
            "message": "Message request accepted." if action == REQUEST_ACCEPTED else "Message request rejected.",
            "request": message_request.to_dict(current_user_id=g.current_user.id),
            "chat_access": get_chat_access_state(g.current_user, sender),
        }
    )


@chat_bp.post("/accept")
@token_required
def accept_message_request():
    return _respond_to_message_request(REQUEST_ACCEPTED)


@chat_bp.post("/reject")
@token_required
def reject_message_request():
    return _respond_to_message_request(REQUEST_REJECTED)
