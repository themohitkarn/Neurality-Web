from datetime import datetime
from sqlalchemy.dialects.postgresql import ARRAY

from extensions import db
from models.associations import reel_likes
from utils.video_handler import build_video_url



class Reel(db.Model):
    __tablename__ = "reels"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    video_path = db.Column(db.String(500), nullable=False)
    thumbnail_path = db.Column(db.String(500), nullable=False)
    cloudinary_public_id = db.Column(db.String(255), nullable=True)
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    aspect_ratio = db.Column(db.String(20), nullable=False, default="9:16")
    orientation = db.Column(db.String(20), nullable=False, default="portrait")
    is_muted = db.Column(db.Boolean, default=False)
    caption = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    views_count = db.Column(db.Integer, default=0, index=True)
    saves_count = db.Column(db.Integer, default=0)
    duration = db.Column(db.Float, nullable=True, default=15.0)
    tags = db.Column(ARRAY(db.String), default=[])

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

    views = db.relationship(
        "ReelView",
        back_populates="reel",
        cascade="all, delete-orphan"
    )

    def to_dict(self, current_user_id=None):
        from models.user import User

        # Check if path is a full URL (Cloudinary)
        video_url = self.video_path if self.video_path.startswith("http") else build_video_url(self.video_path)
        thumbnail_url = self.thumbnail_path if self.thumbnail_path.startswith("http") else build_video_url(self.thumbnail_path)

        payload = {
            "id": self.id,
            "caption": self.caption or "",
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            "width": self.width,
            "height": self.height,
            "aspect_ratio": self.aspect_ratio,
            "orientation": self.orientation,
            "is_muted": self.is_muted,
            "created_at": self.created_at.isoformat(),
            "likes_count": self.liked_by.count(),
            "views_count": self.views_count or 0,
            "reposts_count": self.reposted_by.count(),
            "is_liked": False,
            "is_reposted": False,
            "trending_score": self.calculate_trending_score(),
            "tags": self.tags or [],
            
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

    def calculate_trending_score(self):
        return (
            (self.views_count or 0) * 0.5 +
            self.reposted_by.count() * 4 +
            self.liked_by.count() * 2 +
            (self.saves_count or 0) * 3
        )