from datetime import datetime

from extensions import db
from utils.image_handler import build_media_url


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    content = db.Column(db.String(1000), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    sender = db.relationship("User", foreign_keys=[sender_id], backref=db.backref("sent_messages", lazy="dynamic"))
    receiver = db.relationship(
        "User",
        foreign_keys=[receiver_id],
        backref=db.backref("received_messages", lazy="dynamic"),
    )

    def to_dict(self, current_user_id=None):
        return {
            "id": self.id,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "is_mine": current_user_id == self.sender_id,
            "sender": {
                "id": self.sender.id,
                "username": self.sender.username,
                "profile_pic": build_media_url(self.sender.profile_pic),
            },
            "receiver": {
                "id": self.receiver.id,
                "username": self.receiver.username,
                "profile_pic": build_media_url(self.receiver.profile_pic),
            },
        }
