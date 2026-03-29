from datetime import datetime

from sqlalchemy import and_, or_

from extensions import db
from models.message_request import MessageRequest
from models.user import User


REQUEST_PENDING = "pending"
REQUEST_ACCEPTED = "accepted"
REQUEST_REJECTED = "rejected"


def _follows(sender, receiver):
    return sender.following.filter(User.id == receiver.id).count() > 0


def get_message_request_record(sender_id, receiver_id):
    return MessageRequest.query.filter_by(sender_id=sender_id, receiver_id=receiver_id).first()


def get_accepted_message_request(user_a_id, user_b_id):
    return (
        MessageRequest.query.filter(
            or_(
                and_(MessageRequest.sender_id == user_a_id, MessageRequest.receiver_id == user_b_id),
                and_(MessageRequest.sender_id == user_b_id, MessageRequest.receiver_id == user_a_id),
            ),
            MessageRequest.status == REQUEST_ACCEPTED,
        )
        .order_by(MessageRequest.created_at.desc())
        .first()
    )


def get_chat_access_state(sender, receiver):
    if not sender or not receiver:
        return {
            "can_message_directly": False,
            "can_send_message_request": False,
            "message_request_status": None,
            "message_request_direction": None,
            "message_request_id": None,
            "message_gate_reason": "unknown",
        }

    if sender.id == receiver.id:
        return {
            "can_message_directly": False,
            "can_send_message_request": False,
            "message_request_status": None,
            "message_request_direction": None,
            "message_request_id": None,
            "message_gate_reason": "self",
        }

    accepted_request = get_accepted_message_request(sender.id, receiver.id)
    outgoing_request = get_message_request_record(sender.id, receiver.id)
    incoming_request = get_message_request_record(receiver.id, sender.id)
    follows_receiver = _follows(sender, receiver)

    if not receiver.is_private:
        request_id = accepted_request.id if accepted_request else None
        return {
            "can_message_directly": True,
            "can_send_message_request": False,
            "message_request_status": REQUEST_ACCEPTED if accepted_request else None,
            "message_request_direction": None,
            "message_request_id": request_id,
            "message_gate_reason": "public_account",
        }

    if follows_receiver or accepted_request:
        request_id = accepted_request.id if accepted_request else None
        return {
            "can_message_directly": True,
            "can_send_message_request": False,
            "message_request_status": REQUEST_ACCEPTED if accepted_request else None,
            "message_request_direction": None,
            "message_request_id": request_id,
            "message_gate_reason": "following" if follows_receiver else "accepted_request",
        }

    if outgoing_request and outgoing_request.status == REQUEST_PENDING:
        return {
            "can_message_directly": False,
            "can_send_message_request": False,
            "message_request_status": outgoing_request.status,
            "message_request_direction": "outgoing",
            "message_request_id": outgoing_request.id,
            "message_gate_reason": "pending_outgoing_request",
        }

    if incoming_request and incoming_request.status == REQUEST_PENDING:
        return {
            "can_message_directly": False,
            "can_send_message_request": False,
            "message_request_status": incoming_request.status,
            "message_request_direction": "incoming",
            "message_request_id": incoming_request.id,
            "message_gate_reason": "pending_incoming_request",
        }

    return {
        "can_message_directly": False,
        "can_send_message_request": True,
        "message_request_status": outgoing_request.status if outgoing_request else None,
        "message_request_direction": "outgoing" if outgoing_request else None,
        "message_request_id": outgoing_request.id if outgoing_request else None,
        "message_gate_reason": "private_requires_acceptance",
    }


def create_or_refresh_message_request(sender, receiver):
    if not receiver.is_private:
        raise ValueError("Public accounts can be messaged directly.")

    access_state = get_chat_access_state(sender, receiver)
    if access_state["can_message_directly"]:
        raise ValueError("You can already message this user directly.")

    if not access_state["can_send_message_request"]:
        if access_state["message_gate_reason"] == "pending_outgoing_request":
            raise ValueError("You already sent a message request.")
        if access_state["message_gate_reason"] == "pending_incoming_request":
            raise ValueError("This user already requested to message you. Accept it from Message Requests.")
        raise ValueError("You cannot send a message request to this user.")

    existing_request = get_message_request_record(sender.id, receiver.id)
    now = datetime.utcnow()

    if existing_request:
        existing_request.status = REQUEST_PENDING
        existing_request.created_at = now
        existing_request.responded_at = None
        db.session.commit()
        return existing_request, False

    message_request = MessageRequest(
        sender_id=sender.id,
        receiver_id=receiver.id,
        status=REQUEST_PENDING,
        created_at=now,
    )
    db.session.add(message_request)
    db.session.commit()
    return message_request, True
