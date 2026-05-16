from datetime import datetime, timedelta

from extensions import db
from utils.image_handler import build_media_url


class Story(db.Model):
    __tablename__ = "stories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
    media_type = db.Column(db.String(50), nullable=False, default="image") # image, video, text
    caption = db.Column(db.String(500), nullable=True)
    music = db.Column(db.JSON, nullable=True) # {title, artist, url}
    text_style = db.Column(db.JSON, nullable=True) # {font, color, position}
    is_muted = db.Column(db.Boolean, default=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    reel_id = db.Column(db.Integer, db.ForeignKey("reels.id", ondelete="CASCADE"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    expires_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.utcnow() + timedelta(hours=24),
        index=True,
    )

    shared_post = db.relationship("Post", backref=db.backref("shared_in_stories", lazy="dynamic"))
    shared_reel = db.relationship("Reel", backref=db.backref("shared_in_stories", lazy="dynamic"))

    author = db.relationship("User", back_populates="stories")
    viewers = db.relationship("StorySeen", back_populates="story", cascade="all, delete-orphan")
    reactions = db.relationship("StoryReaction", back_populates="story", cascade="all, delete-orphan")

    def to_dict(self, current_user_id=None):
        is_seen = False
        if current_user_id:
            is_seen = any(v.user_id == current_user_id for v in self.viewers)

        return {
            "id": self.id,
            "image_url": build_media_url(self.image_path),
            "media_type": self.media_type,
            "caption": self.caption,
            "music": self.music,
            "text_style": self.text_style,
            "is_muted": self.is_muted,
            "post_id": self.post_id,
            "reel_id": self.reel_id,
            "shared_content": self.shared_post.to_dict(current_user_id=current_user_id) if self.shared_post else (self.shared_reel.to_dict(current_user_id=current_user_id) if self.shared_reel else None),
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "is_seen": is_seen,
            "views_count": len(self.viewers),
            "author": {
                "id": self.author.id,
                "username": self.author.username,
                "profile_pic": build_media_url(self.author.profile_pic),
            },
            "reactions": [r.to_dict() for r in self.reactions]
        }


class StorySeen(db.Model):
    __tablename__ = "story_seen"
    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey("stories.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    story = db.relationship("Story", back_populates="viewers")


class StoryReaction(db.Model):
    __tablename__ = "story_reactions"
    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey("stories.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    story = db.relationship("Story", back_populates="reactions")

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "emoji": self.emoji,
            "created_at": self.created_at.isoformat()
        }
