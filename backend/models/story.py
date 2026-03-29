from datetime import datetime, timedelta

from extensions import db
from utils.image_handler import build_media_url


class Story(db.Model):
    __tablename__ = "stories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    expires_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.utcnow() + timedelta(hours=24),
        index=True,
    )

    author = db.relationship("User", back_populates="stories")

    def to_dict(self):
        return {
            "id": self.id,
            "image_url": build_media_url(self.image_path),
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "author": {
                "id": self.author.id,
                "username": self.author.username,
                "profile_pic": build_media_url(self.author.profile_pic),
            },
        }
