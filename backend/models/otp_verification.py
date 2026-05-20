import uuid
from datetime import datetime

from extensions import db


class OtpVerification(db.Model):
    __tablename__ = "otp_verifications"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    identifier = db.Column(db.String(120), nullable=False)
    otp = db.Column(db.String(64), nullable=False)
    purpose = db.Column(db.String(50), nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "identifier": self.identifier,
            "purpose": self.purpose,
            "attempts": self.attempts,
            "is_verified": self.is_verified,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
