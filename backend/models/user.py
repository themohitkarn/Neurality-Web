from datetime import datetime
from sqlalchemy import and_, or_

from extensions import bcrypt, db
from models.associations import followers, post_likes, reel_likes
from utils.image_handler import build_media_url


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=True)
    bio = db.Column(db.String(255), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    location = db.Column(db.String(120), nullable=True)
    profile_pic = db.Column(db.String(255), nullable=True)
    theme_preference = db.Column(db.String(20), nullable=False, default="system")
    is_private = db.Column(db.Boolean, nullable=False, default=False)
    account_type = db.Column(db.String(20), nullable=False, default="personal")
    allow_message_requests = db.Column(db.Boolean, nullable=False, default=True)
    show_activity_status = db.Column(db.Boolean, nullable=False, default=True)
    email_notifications = db.Column(db.Boolean, nullable=False, default=True)
    push_notifications = db.Column(db.Boolean, nullable=False, default=True)
    autoplay_reels = db.Column(db.Boolean, nullable=False, default=True)
    reduce_data_usage = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    posts = db.relationship(
        "Post",
        back_populates="author",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    comments = db.relationship(
        "Comment",
        back_populates="author",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    stories = db.relationship(
        "Story",
        back_populates="author",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    reels = db.relationship(
        "Reel",
        back_populates="author",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    following = db.relationship(
        "User",
        secondary=followers,
        primaryjoin=(followers.c.follower_id == id),
        secondaryjoin=(followers.c.followed_id == id),
        backref=db.backref("followers", lazy="dynamic"),
        lazy="dynamic",
    )
    liked_posts = db.relationship(
        "Post",
        secondary=post_likes,
        back_populates="liked_by",
        lazy="dynamic",
    )
    liked_reels = db.relationship(
        "Reel",
        secondary=reel_likes,
        back_populates="liked_by",
        lazy="dynamic",
    )

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def is_followed_by(self, viewer_id):
        if not viewer_id:
            return False
        return self.followers.filter(User.id == viewer_id).count() > 0

    def can_view_profile(self, viewer_id):
        if not self.is_private or viewer_id == self.id:
            return True
        return self.is_followed_by(viewer_id)

    def can_receive_messages_from(self, viewer_id):
        if viewer_id == self.id:
            return True
        if not self.is_private:
            return True
        if self.is_followed_by(viewer_id):
            return True

        from models.message_request import MessageRequest
        from utils.chat_rules import REQUEST_ACCEPTED

        return (
            MessageRequest.query.filter(
                or_(
                    and_(MessageRequest.sender_id == viewer_id, MessageRequest.receiver_id == self.id),
                    and_(MessageRequest.sender_id == self.id, MessageRequest.receiver_id == viewer_id),
                ),
                MessageRequest.status == REQUEST_ACCEPTED,
            ).count()
            > 0
        )

    def to_dict(self, viewer_id=None, include_email=False, include_posts=False, include_settings=False):
        from models.post import Post
        from models.story import Story

        is_self = viewer_id == self.id
        is_following = False
        if viewer_id and viewer_id != self.id:
            is_following = self.is_followed_by(viewer_id)

        payload = {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name or "",
            "bio": self.bio or "",
            "website": self.website or "",
            "location": self.location or "",
            "profile_pic": build_media_url(self.profile_pic),
            "followers_count": self.followers.count(),
            "following_count": self.following.count(),
            "posts_count": self.posts.count(),
            "reels_count": self.reels.count(),
            "account_type": self.account_type or "personal",
            "created_at": self.created_at.isoformat(),
            "is_self": is_self,
            "is_following": is_following,
            "is_private": bool(self.is_private),
            "can_message": self.can_receive_messages_from(viewer_id) if viewer_id else bool(self.allow_message_requests),
        }

        if include_email:
            payload["email"] = self.email

        if include_settings:
            payload["settings"] = {
                "theme_preference": self.theme_preference or "system",
                "is_private": bool(self.is_private),
                "account_type": self.account_type or "personal",
                "allow_message_requests": bool(self.allow_message_requests),
                "show_activity_status": bool(self.show_activity_status),
                "email_notifications": bool(self.email_notifications),
                "push_notifications": bool(self.push_notifications),
                "autoplay_reels": bool(self.autoplay_reels),
                "reduce_data_usage": bool(self.reduce_data_usage),
            }
            payload["theme_preference"] = self.theme_preference or "system"

        if include_posts:
            can_view_posts = self.can_view_profile(viewer_id)
            payload["requires_follow"] = bool(self.is_private and not can_view_posts)
            payload["posts"] = []
            payload["stories"] = []

            if can_view_posts:
                payload["posts"] = [
                    post.to_dict(current_user_id=viewer_id, include_comments=True)
                    for post in self.posts.order_by(Post.created_at.desc()).all()
                ]
                payload["stories"] = [
                    story.to_dict()
                    for story in self.stories.filter(Story.expires_at > datetime.utcnow())
                    .order_by(Story.created_at.desc())
                    .all()
                ]

        return payload
