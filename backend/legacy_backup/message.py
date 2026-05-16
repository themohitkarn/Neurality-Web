from datetime import datetime

from extensions import db
from utils.image_handler import build_media_url

# DEPRECATED: This model is legacy. 
# All messaging is now handled by the Node.js realtime-server using the Prisma 'messages' model.
# DO NOT USE this model for new logic.


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True)
    content = db.Column(db.String(1000), nullable=False)
    message_type = db.Column(db.String(20), nullable=False, default="text")  # text, voice, image
    # Reply-to support
    reply_to_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True)
    # Read receipts
    is_read = db.Column(db.Boolean, default=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)
    # Pin support
    is_pinned = db.Column(db.Boolean, default=False)
    # Vanish Mode
    is_vanish = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    sender = db.relationship("User", foreign_keys=[sender_id], backref=db.backref("sent_messages", lazy="dynamic"))
    receiver = db.relationship(
        "User",
        foreign_keys=[receiver_id],
        backref=db.backref("received_messages", lazy="dynamic"),
    )
    group_rel = db.relationship("Group", backref=db.backref("messages", lazy="dynamic", cascade="all, delete-orphan"))
    reply_to = db.relationship("Message", remote_side=[id], backref="replies")
    reactions = db.relationship("MessageReaction", backref="message", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, current_user_id=None):
        reply_preview = None
        if self.reply_to:
            reply_preview = {
                "id": self.reply_to.id,
                "content": self.reply_to.content[:100],
                "sender_id": self.reply_to.sender_id,
                "sender_username": self.reply_to.sender.username if self.reply_to.sender else "Unknown",
            }

        reaction_list = [r.to_dict() for r in self.reactions.all()] if self.reactions else []

        result = {
            "id": self.id,
            "content": self.content,
            "message_type": self.message_type or "text",
            "created_at": self.created_at.isoformat() + "Z",
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "group_id": self.group_id,
            "is_mine": current_user_id == self.sender_id,
            "is_read": bool(self.is_read),
            "read_at": self.read_at.isoformat() + "Z" if self.read_at else None,
            "is_pinned": bool(self.is_pinned),
            "is_vanish": bool(self.is_vanish),
            "reply_to": reply_preview,
            "reactions": reaction_list,
            "sender": {
                "id": self.sender.id,
                "username": self.sender.username,
                "profile_pic": build_media_url(self.sender.profile_pic),
            } if self.sender else None,
        }

        # Receiver is None for group messages — handle safely
        if self.receiver:
            result["receiver"] = {
                "id": self.receiver.id,
                "username": self.receiver.username,
                "profile_pic": build_media_url(self.receiver.profile_pic),
            }
        else:
            result["receiver"] = None

        return result


class MessageReaction(db.Model):
    """Emoji reactions on messages."""
    __tablename__ = "message_reactions"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("message_id", "user_id", "emoji", name="uq_message_reaction"),)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "emoji": self.emoji,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
        }
