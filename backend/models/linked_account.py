import uuid
from datetime import datetime

from extensions import db


class LinkedAccount(db.Model):
    __tablename__ = "linked_accounts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = db.Column(db.String(50), nullable=False)
    identifier = db.Column(db.String(255), unique=True, nullable=False)
    is_primary = db.Column(db.Boolean, nullable=False, default=False)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("linked_accounts", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "identifier": self.identifier,
            "is_primary": self.is_primary,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
