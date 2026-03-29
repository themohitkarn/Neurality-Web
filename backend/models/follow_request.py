from datetime import datetime

from extensions import db
from utils.image_handler import build_media_url


class FollowRequest(db.Model):
    __tablename__ = "follow_requests"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    responded_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("sender_id", "receiver_id", name="uq_follow_requests_sender_receiver"),
    )

    sender = db.relationship(
        "User",
        foreign_keys=[sender_id],
        backref=db.backref("sent_follow_requests", lazy="dynamic", cascade="all, delete-orphan"),
    )
    receiver = db.relationship(
        "User",
        foreign_keys=[receiver_id],
        backref=db.backref("received_follow_requests", lazy="dynamic", cascade="all, delete-orphan"),
    )

    def to_dict(self, current_user_id=None):
        direction = None
        if current_user_id == self.receiver_id:
            direction = "incoming"
        elif current_user_id == self.sender_id:
            direction = "outgoing"

        return {
            "id": self.id,
            "status": self.status,
            "direction": direction,
            "created_at": self.created_at.isoformat(),
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "sender": {
                "id": self.sender.id,
                "username": self.sender.username,
                "profile_pic": build_media_url(self.sender.profile_pic),
                "is_private": bool(self.sender.is_private),
                "account_type": self.sender.account_type or "personal",
            },
            "receiver": {
                "id": self.receiver.id,
                "username": self.receiver.username,
                "profile_pic": build_media_url(self.receiver.profile_pic),
                "is_private": bool(self.receiver.is_private),
                "account_type": self.receiver.account_type or "personal",
            },
        }
