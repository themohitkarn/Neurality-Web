from datetime import datetime

from extensions import db
from models.follow_request import FollowRequest
from models.user import User


FOLLOW_REQUEST_PENDING = "pending"
FOLLOW_REQUEST_ACCEPTED = "accepted"
FOLLOW_REQUEST_REJECTED = "rejected"


def get_follow_request_record(sender_id, receiver_id):
    return FollowRequest.query.filter_by(sender_id=sender_id, receiver_id=receiver_id).first()


def get_follow_access_state(viewer, target):
    if not viewer or not target:
        return {
            "can_follow_directly": False,
            "can_request_follow": False,
            "follow_request_status": None,
            "follow_request_direction": None,
            "follow_request_id": None,
            "follow_gate_reason": "unknown",
        }

    if viewer.id == target.id:
        return {
            "can_follow_directly": False,
            "can_request_follow": False,
            "follow_request_status": None,
            "follow_request_direction": None,
            "follow_request_id": None,
            "follow_gate_reason": "self",
        }

    is_following = viewer.following.filter(User.id == target.id).count() > 0
    outgoing_request = get_follow_request_record(viewer.id, target.id)
    incoming_request = get_follow_request_record(target.id, viewer.id)

    if is_following:
        return {
            "can_follow_directly": False,
            "can_request_follow": False,
            "follow_request_status": FOLLOW_REQUEST_ACCEPTED,
            "follow_request_direction": None,
            "follow_request_id": outgoing_request.id if outgoing_request and outgoing_request.status == FOLLOW_REQUEST_ACCEPTED else None,
            "follow_gate_reason": "already_following",
        }

    if outgoing_request and outgoing_request.status == FOLLOW_REQUEST_PENDING:
        return {
            "can_follow_directly": False,
            "can_request_follow": False,
            "follow_request_status": outgoing_request.status,
            "follow_request_direction": "outgoing",
            "follow_request_id": outgoing_request.id,
            "follow_gate_reason": "pending_outgoing_request",
        }

    if incoming_request and incoming_request.status == FOLLOW_REQUEST_PENDING:
        return {
            "can_follow_directly": False,
            "can_request_follow": False,
            "follow_request_status": incoming_request.status,
            "follow_request_direction": "incoming",
            "follow_request_id": incoming_request.id,
            "follow_gate_reason": "pending_incoming_request",
        }

    if target.is_private:
        return {
            "can_follow_directly": False,
            "can_request_follow": True,
            "follow_request_status": outgoing_request.status if outgoing_request else None,
            "follow_request_direction": "outgoing" if outgoing_request else None,
            "follow_request_id": outgoing_request.id if outgoing_request else None,
            "follow_gate_reason": "private_requires_approval",
        }

    return {
        "can_follow_directly": True,
        "can_request_follow": False,
        "follow_request_status": None,
        "follow_request_direction": None,
        "follow_request_id": None,
        "follow_gate_reason": "public_follow",
    }


def create_or_refresh_follow_request(sender, receiver):
    if not receiver.is_private:
        raise ValueError("This account can be followed directly.")

    existing_request = get_follow_request_record(sender.id, receiver.id)
    now = datetime.utcnow()

    if existing_request:
        existing_request.status = FOLLOW_REQUEST_PENDING
        existing_request.created_at = now
        existing_request.responded_at = None
        return existing_request, False

    follow_request = FollowRequest(
        sender_id=sender.id,
        receiver_id=receiver.id,
        status=FOLLOW_REQUEST_PENDING,
        created_at=now,
    )
    return follow_request, True


def follow_user(current_user, target_user):
    existing_follow = current_user.following.filter(User.id == target_user.id).first()
    if existing_follow:
        return {
            "message": "You are already following this user.",
            "following": True,
            "follow_requested": False,
        }

    if target_user.is_private:
        follow_request, created = create_or_refresh_follow_request(current_user, target_user)
        if created:
            db.session.add(follow_request)
        return {
            "message": "Follow request sent." if created else "Follow request sent again.",
            "following": False,
            "follow_requested": True,
        }

    current_user.following.append(target_user)
    return {
        "message": "User followed.",
        "following": True,
        "follow_requested": False,
    }


def unfollow_user(current_user, target_user):
    existing_follow = current_user.following.filter(User.id == target_user.id).first()
    outgoing_request = get_follow_request_record(current_user.id, target_user.id)

    if existing_follow:
        current_user.following.remove(target_user)
        if outgoing_request and outgoing_request.status == FOLLOW_REQUEST_ACCEPTED:
            outgoing_request.status = FOLLOW_REQUEST_REJECTED
            outgoing_request.responded_at = datetime.utcnow()

        return {
            "message": "User unfollowed.",
            "following": False,
            "follow_requested": False,
        }

    if outgoing_request and outgoing_request.status == FOLLOW_REQUEST_PENDING:
        db.session.delete(outgoing_request)
        return {
            "message": "Follow request canceled.",
            "following": False,
            "follow_requested": False,
        }

    return {
        "message": "Nothing to unfollow.",
        "following": False,
        "follow_requested": False,
    }


def toggle_follow_user(current_user, target_user):
    existing_follow = current_user.following.filter(User.id == target_user.id).first()
    outgoing_request = get_follow_request_record(current_user.id, target_user.id)
    if existing_follow or (outgoing_request and outgoing_request.status == FOLLOW_REQUEST_PENDING):
        return unfollow_user(current_user, target_user)
    return follow_user(current_user, target_user)


def list_follow_requests_for_user(user_id):
    incoming = (
        FollowRequest.query.filter_by(receiver_id=user_id, status=FOLLOW_REQUEST_PENDING)
        .order_by(FollowRequest.created_at.desc())
        .all()
    )
    outgoing = (
        FollowRequest.query.filter_by(sender_id=user_id, status=FOLLOW_REQUEST_PENDING)
        .order_by(FollowRequest.created_at.desc())
        .all()
    )
    return incoming, outgoing


def respond_to_follow_request(current_user, request_id, action):
    if action not in {FOLLOW_REQUEST_ACCEPTED, FOLLOW_REQUEST_REJECTED}:
        raise ValueError("action must be accepted or rejected.")

    follow_request = db.session.get(FollowRequest, request_id)
    if not follow_request:
        raise LookupError("Follow request not found.")

    if follow_request.receiver_id != current_user.id:
        raise PermissionError("You cannot respond to this follow request.")

    if follow_request.status != FOLLOW_REQUEST_PENDING:
        raise RuntimeError("This follow request has already been handled.")

    sender = db.session.get(User, follow_request.sender_id)
    if not sender:
        raise LookupError("Request sender no longer exists.")

    follow_request.status = action
    follow_request.responded_at = datetime.utcnow()

    if action == FOLLOW_REQUEST_ACCEPTED and not sender.following.filter(User.id == current_user.id).first():
        sender.following.append(current_user)

    return follow_request
