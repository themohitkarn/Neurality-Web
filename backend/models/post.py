from datetime import datetime

from extensions import db
from models.associations import post_likes
from utils.image_handler import build_media_url


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
    media_type = db.Column(db.String(50), nullable=False, default="image")
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    aspect_ratio = db.Column(db.String(20), nullable=True)
    orientation = db.Column(db.String(20), nullable=True)
    audio_path = db.Column(db.String(255), nullable=True)
    is_muted = db.Column(db.Boolean, default=False)
    caption = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    author = db.relationship("User", back_populates="posts")
    comments = db.relationship(
        "Comment",
        back_populates="post",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    liked_by = db.relationship(
        "User",
        secondary=post_likes,
        back_populates="liked_posts",
        lazy="dynamic",
    )
    reposted_by = db.relationship(
        "User",
        secondary="post_reposts",
        back_populates="reposted_posts",
        lazy="dynamic",
    )

    def to_dict(self, current_user_id=None, include_comments=True):
        from models.comment import Comment
        from models.user import User

        # Build carousel: if post has carousel_images, include them. Otherwise use the single image_path.
        carousel = []
        if hasattr(self, 'carousel_images') and self.carousel_images.count() > 0:
            carousel = [img.to_dict() for img in self.carousel_images.order_by("position").all()]

        payload = {
            "id": self.id,
            "caption": self.caption or "",
            "image_url": build_media_url(self.image_path),
            "audio_url": build_media_url(self.audio_path) if self.audio_path else None,
            "media_type": self.media_type,
            "width": self.width,
            "height": self.height,
            "aspect_ratio": self.aspect_ratio,
            "orientation": self.orientation,
            "has_audio": bool(self.audio_path),
            "is_muted": self.is_muted,
            "carousel_images": carousel,
            "is_carousel": len(carousel) > 0,
            "created_at": self.created_at.isoformat(),
            "likes_count": self.liked_by.count(),
            "comments_count": self.comments.count(),
            "is_saved": False,
            "is_pinned": False,
            "is_reposted": False,
            "reposts_count": self.reposted_by.count(),
            "author": self.author.to_dict(viewer_id=current_user_id, include_email=False),
        }

        if current_user_id:
            payload["is_liked"] = self.liked_by.filter(User.id == current_user_id).count() > 0
            payload["is_reposted"] = self.reposted_by.filter(User.id == current_user_id).count() > 0

            from models.social import SavedPost, PinnedPost
            payload["is_saved"] = SavedPost.query.filter_by(user_id=current_user_id, post_id=self.id).count() > 0
            payload["is_pinned"] = PinnedPost.query.filter_by(user_id=current_user_id, post_id=self.id).count() > 0

        if include_comments:
            payload["comments"] = [
                comment.to_dict(current_user_id=current_user_id)
                for comment in self.comments.order_by(Comment.created_at.asc()).all()
            ]

        return payload
