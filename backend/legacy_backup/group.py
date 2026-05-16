from extensions import db
from utils.image_handler import build_media_url

# DEPRECATED: This model is legacy. 
# All group management is now handled by the Node.js realtime-server.

class Group(db.Model):
    __tablename__ = "groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    group_pic = db.Column(db.String(255), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    creator = db.relationship("User", foreign_keys=[created_by])
    members = db.relationship("GroupMember", backref="group", lazy="dynamic", cascade="all, delete-orphan")
    
    # We will add the messages relationship backref in the Message model or here
    # messages = db.relationship("Message", backref="group", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, include_members=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "group_pic": build_media_url(self.group_pic),
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "member_count": self.members.count(),
            "is_group": True
        }
        if include_members:
            data["members"] = [m.to_dict() for m in self.members.all()]
        return data

class GroupMember(db.Model):
    __tablename__ = "group_members"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(20), default="member")  # member, admin
    joined_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User")

    __table_args__ = (db.UniqueConstraint("group_id", "user_id", name="uq_group_member"),)

    def to_dict(self):
        return {
            "id": self.id,
            "group_id": self.group_id,
            "user_id": self.user_id,
            "role": self.role,
            "joined_at": self.joined_at.isoformat(),
            "user": {
                "id": self.user.id,
                "username": self.user.username,
                "profile_pic": build_media_url(self.user.profile_pic),
                "is_online": False # Placeholder
            } if self.user else None,
        }
