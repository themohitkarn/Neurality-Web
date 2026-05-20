import uuid
from datetime import datetime
from extensions import db

class DeviceSession(db.Model):
    __tablename__ = "device_sessions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    device_name = db.Column(db.String(100), nullable=True)
    location = db.Column(db.String(100), nullable=True, default="Unknown Location")
    last_active = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    refresh_token = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("device_sessions", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "device_name": self.device_name,
            "location": self.location,
            "last_active": self.last_active.isoformat() if self.last_active else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
