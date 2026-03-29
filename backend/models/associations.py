from extensions import db


followers = db.Table(
    "followers",
    db.Column("follower_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("followed_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("created_at", db.DateTime, nullable=False, server_default=db.func.now()),
)


post_likes = db.Table(
    "post_likes",
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("post_id", db.Integer, db.ForeignKey("posts.id"), primary_key=True),
    db.Column("created_at", db.DateTime, nullable=False, server_default=db.func.now()),
)


reel_likes = db.Table(
    "reel_likes",
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("reel_id", db.Integer, db.ForeignKey("reels.id"), primary_key=True),
    db.Column("created_at", db.DateTime, nullable=False, server_default=db.func.now()),
)
