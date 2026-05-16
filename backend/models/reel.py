from datetime import datetime

from extensions import db
from models.associations import reel_likes
from utils.video_handler import build_video_url


class Reel(db.Model):
    __tablename__ = "reels"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    video_path = db.Column(db.String(255), nullable=False)
    thumbnail_path = db.Column(db.String(255), nullable=False)
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    aspect_ratio = db.Column(db.String(20), nullable=False, default="9:16")
    orientation = db.Column(db.String(20), nullable=False, default="portrait")
    is_muted = db.Column(db.Boolean, default=False)
    caption = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    author = db.relationship("User", back_populates="reels")

    liked_by = db.relationship(
        "User",
        secondary=reel_likes,
        back_populates="liked_reels",
        lazy="dynamic",
    )

    reposted_by = db.relationship(
        "User",
        secondary="reel_reposts",
        back_populates="reposted_reels",
        lazy="dynamic",
    )

    def to_dict(self, current_user_id=None):
        from models.user import User

        payload = {
            "id": self.id,
            "caption": self.caption or "",
            "video_url": build_video_url(self.video_path),
            "thumbnail_url": build_video_url(self.thumbnail_path),
            "width": self.width,
            "height": self.height,
            "aspect_ratio": self.aspect_ratio,
            "orientation": self.orientation,
            "is_muted": self.is_muted,
            "created_at": self.created_at.isoformat(),
            "likes_count": self.liked_by.count(),
            "reposts_count": self.reposted_by.count(),
            "is_liked": False,
            "is_reposted": False,
            "author": self.author.to_dict(viewer_id=current_user_id, include_email=False),
        }

        if current_user_id:
            payload["is_liked"] = (
                self.liked_by.filter(User.id == current_user_id).count() > 0
            )
            payload["is_reposted"] = (
                self.reposted_by.filter(User.id == current_user_id).count() > 0
            )

        return payload