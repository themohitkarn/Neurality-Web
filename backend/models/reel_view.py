from extensions import db
from datetime import datetime


class ReelView(db.Model):
    __tablename__ = "reel_views"
    id = db.Column(db.Integer, primary_key=True)

    reel_id = db.Column(
        db.Integer,
        db.ForeignKey("reels.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    watch_time = db.Column(db.Integer, default=0)
    completed = db.Column(db.Boolean, default=False)
    viewed_at = db.Column(db.DateTime, default=datetime.utcnow)
    reel = db.relationship("Reel", back_populates="views")
    user = db.relationship("User")

    __table_args__ = (
        db.UniqueConstraint("reel_id", "user_id"),
    )