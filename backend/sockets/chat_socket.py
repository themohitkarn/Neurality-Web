from datetime import datetime

from flask import request
from flask_socketio import emit, join_room

from extensions import db
from models.message import Message
from models.user import User
from utils.chat_rules import create_or_refresh_message_request, get_chat_access_state
from utils.jwt_helper import decode_token


ACTIVE_SOCKET_USERS = {}
CHAT_EVENTS_REGISTERED = False


def _room_name(user_id):
    return f"user_{user_id}"


def _resolve_socket_user(auth):
    token = auth.get("token") if isinstance(auth, dict) else None
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    return db.session.get(User, payload["user_id"])


def _current_socket_user():
    user_id = ACTIVE_SOCKET_USERS.get(request.sid)
    if not user_id:
        return None
    return db.session.get(User, user_id)


def register_chat_socket_handlers(socketio_instance):
    global CHAT_EVENTS_REGISTERED

    if CHAT_EVENTS_REGISTERED:
        return

    CHAT_EVENTS_REGISTERED = True

    @socketio_instance.on("connect")
    def handle_connect(auth=None):
        user = _resolve_socket_user(auth or {})
        if not user:
            return False

        ACTIVE_SOCKET_USERS[request.sid] = user.id
        join_room(_room_name(user.id))
        emit("connection_ack", {"user_id": user.id})

    @socketio_instance.on("disconnect")
    def handle_disconnect():
        ACTIVE_SOCKET_USERS.pop(request.sid, None)

    @socketio_instance.on("typing_indicator")
    def handle_typing_indicator(payload):
        user = _current_socket_user()
        if not user:
            emit("message_error", {"message": "Unauthorized socket session."})
            return

        receiver_id = payload.get("receiver_id")
        is_typing = bool(payload.get("is_typing"))
        receiver = db.session.get(User, receiver_id)
        if not receiver:
            return

        access_state = get_chat_access_state(user, receiver)
        if not access_state["can_message_directly"]:
            return

        emit(
            "typing_indicator",
            {
                "from_user_id": user.id,
                "to_user_id": receiver.id,
                "is_typing": is_typing,
            },
            to=_room_name(receiver.id),
        )

    @socketio_instance.on("send_message")
    def handle_send_message(payload):
        user = _current_socket_user()
        if not user:
            emit("message_error", {"message": "Unauthorized socket session."})
            return

        receiver_id = payload.get("receiver_id")
        content = (payload.get("content") or "").strip()

        if not receiver_id or not content:
            emit("message_error", {"message": "receiver_id and content are required."})
            return

        if len(content) > 1000:
            emit("message_error", {"message": "Messages must be 1000 characters or fewer."})
            return

        receiver = db.session.get(User, receiver_id)
        if not receiver or receiver.id == user.id:
            emit("message_error", {"message": "Choose a valid recipient."})
            return

        access_state = get_chat_access_state(user, receiver)
        if not access_state["can_message_directly"]:
            if receiver.is_private:
                try:
                    message_request, _created = create_or_refresh_message_request(user, receiver)
                    request_payload = message_request.to_dict()
                    emit("message_request_created", request_payload, to=_room_name(user.id))
                    emit("message_request_created", request_payload, to=_room_name(receiver.id))
                except ValueError as exc:
                    emit("message_error", {"message": str(exc)})
                return

            emit("message_error", {"message": f"You can message {receiver.username} directly now. Try again."})
            return

        recent_duplicate = (
            Message.query.filter_by(sender_id=user.id, receiver_id=receiver.id, content=content)
            .order_by(Message.created_at.desc())
            .first()
        )
        if recent_duplicate and (datetime.utcnow() - recent_duplicate.created_at).total_seconds() < 8:
            emit("message_error", {"message": "Duplicate message blocked. Try again in a moment."})
            return

        message = Message(sender_id=user.id, receiver_id=receiver.id, content=content)
        db.session.add(message)
        db.session.commit()

        message_payload = message.to_dict(current_user_id=user.id)
        emit("receive_message", message_payload, to=_room_name(user.id))
        emit("receive_message", message_payload, to=_room_name(receiver.id))
        emit(
            "typing_indicator",
            {
                "from_user_id": user.id,
                "to_user_id": receiver.id,
                "is_typing": False,
            },
            to=_room_name(receiver.id),
        )
