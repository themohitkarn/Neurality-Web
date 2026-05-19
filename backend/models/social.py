from datetime import datetime

from extensions import db
from utils.image_handler import build_media_url


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    type = db.Column(db.String(50), nullable=False, index=True)
    # Types: like, comment, follow, follow_request, mention, story_reaction, reel_like
    target_type = db.Column(db.String(50), nullable=True)  # post, reel, story, comment
    target_id = db.Column(db.Integer, nullable=True)
    body = db.Column(db.String(500), nullable=True)
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    user = db.relationship("User", foreign_keys=[user_id], backref=db.backref("notifications", lazy="dynamic"))
    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self):
        actor_data = None
        if self.actor:
            actor_data = {
                "id": self.actor.id,
                "username": self.actor.username,
                "profile_pic": build_media_url(self.actor.profile_pic),
            }

        return {
            "id": self.id,
            "type": self.type,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "body": self.body,
            "is_read": self.is_read,
            "actor": actor_data,
            "created_at": self.created_at.isoformat(),
        }


class PostImage(db.Model):
    """Supports multi-image carousel posts."""
    __tablename__ = "post_images"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
    media_type = db.Column(db.String(50), default="image")  # image or video
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    position = db.Column(db.Integer, nullable=False, default=0)  # Order in carousel

    post = db.relationship("Post", backref=db.backref("carousel_images", lazy="dynamic", cascade="all, delete-orphan", order_by="PostImage.position"))

    def to_dict(self):
        return {
            "id": self.id,
            "image_url": build_media_url(self.image_path),
            "media_type": self.media_type,
            "width": self.width,
            "height": self.height,
            "position": self.position,
        }


class SavedPost(db.Model):
    """Users can bookmark/save posts or reels."""
    __tablename__ = "saved_posts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    reel_id = db.Column(db.Integer, db.ForeignKey("reels.id", ondelete="CASCADE"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("saved_posts_rel", lazy="dynamic"))
    post = db.relationship("Post", backref=db.backref("saved_by", lazy="dynamic"))
    reel = db.relationship("Reel", backref=db.backref("saved_by", lazy="dynamic"))


class PinnedPost(db.Model):
    """Users can pin up to 3 posts to their profile."""
    __tablename__ = "pinned_posts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("user_id", "post_id", name="uq_pinned_post"),)

    user = db.relationship("User", backref=db.backref("pinned_posts", lazy="dynamic"))
    post = db.relationship("Post", backref=db.backref("pinned_by", lazy="dynamic"))


class StoryHighlight(db.Model):
    """Story highlights that persist on profile."""
    __tablename__ = "story_highlights"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(100), nullable=False)
    cover_image = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("highlights", lazy="dynamic", cascade="all, delete-orphan"))
    items = db.relationship("StoryHighlightItem", backref="highlight", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "cover_image": build_media_url(self.cover_image),
            "items_count": self.items.count(),
            "created_at": self.created_at.isoformat(),
        }


class StoryHighlightItem(db.Model):
    __tablename__ = "story_highlight_items"

    id = db.Column(db.Integer, primary_key=True)
    highlight_id = db.Column(db.Integer, db.ForeignKey("story_highlights.id", ondelete="CASCADE"), nullable=False, index=True)
    story_id = db.Column(db.Integer, db.ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    position = db.Column(db.Integer, default=0)

    story = db.relationship("Story")


class CloseFriend(db.Model):
    """Close friends list for exclusive story sharing."""
    __tablename__ = "close_friends"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    friend_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("user_id", "friend_id", name="uq_close_friend"),)


class Report(db.Model):
    """Content/user reports for moderation."""
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    target_type = db.Column(db.String(50), nullable=False)  # user, post, reel, story, comment, message
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(20), default="pending")  # pending, reviewed, resolved, dismissed
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by])

    def to_dict(self):
        return {
            "id": self.id,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "reason": self.reason,
            "description": self.description,
            "status": self.status,
            "reporter": {
                "id": self.reporter.id,
                "username": self.reporter.username,
            },
            "created_at": self.created_at.isoformat(),
        }


class BlockedUser(db.Model):
    """Block/restrict users."""
    __tablename__ = "blocked_users"

    id = db.Column(db.Integer, primary_key=True)
    blocker_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    blocked_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("blocker_id", "blocked_id", name="uq_blocked_user"),)

    blocker = db.relationship("User", foreign_keys=[blocker_id], backref=db.backref("blocked_users", lazy="dynamic"))
    blocked = db.relationship("User", foreign_keys=[blocked_id])


class HiddenContent(db.Model):
    """Tracks posts or reels that a user has marked as 'Not interested'."""
    __tablename__ = "hidden_contents"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    reel_id = db.Column(db.Integer, db.ForeignKey("reels.id", ondelete="CASCADE"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("user_id", "post_id", "reel_id", name="uq_hidden_content"),)

    user = db.relationship("User", backref=db.backref("hidden_contents_list", lazy="dynamic"))
    post = db.relationship("Post")
    reel = db.relationship("Reel")
