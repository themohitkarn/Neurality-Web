from datetime import datetime

from extensions import db
from models.associations import post_likes
from utils.image_handler import build_media_url


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
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

    def to_dict(self, current_user_id=None, include_comments=True):
        from models.comment import Comment
        from models.user import User

        payload = {
            "id": self.id,
            "caption": self.caption or "",
            "image_url": build_media_url(self.image_path),
            "created_at": self.created_at.isoformat(),
            "likes_count": self.liked_by.count(),
            "comments_count": self.comments.count(),
            "is_liked": False,
            "author": self.author.to_dict(viewer_id=current_user_id, include_email=False),
        }

        if current_user_id:
            payload["is_liked"] = self.liked_by.filter(User.id == current_user_id).count() > 0

        if include_comments:
            payload["comments"] = [
                comment.to_dict(current_user_id=current_user_id)
                for comment in self.comments.order_by(Comment.created_at.asc()).all()
            ]

        return payload
