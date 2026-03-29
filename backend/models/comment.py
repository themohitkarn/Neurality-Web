from datetime import datetime

from extensions import db


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    content = db.Column(db.String(280), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    author = db.relationship("User", back_populates="comments")
    post = db.relationship("Post", back_populates="comments")

    def to_dict(self, current_user_id=None):
        return {
            "id": self.id,
            "post_id": self.post_id,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
            "can_delete": current_user_id == self.user_id,
            "author": {
                "id": self.author.id,
                "username": self.author.username,
                "profile_pic": self.author.to_dict().get("profile_pic"),
            },
        }
