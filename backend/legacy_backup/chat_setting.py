from extensions import db

# DEPRECATED: This model is legacy. 
# All chat settings are now handled by the Node.js realtime-server using the Prisma 'chat_settings' model.

class ChatSetting(db.Model):
    __tablename__ = "chat_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    # For DM, either target_user_id or group_id will be set
    target_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=True)
    
    read_receipts_enabled = db.Column(db.Boolean, nullable=False, default=True)
    typing_indicators_enabled = db.Column(db.Boolean, nullable=False, default=True)
    is_muted = db.Column(db.Boolean, nullable=False, default=False)
    is_pinned = db.Column(db.Boolean, nullable=False, default=False)
    theme_color = db.Column(db.String(20), nullable=True) # e.g., 'indigo', 'rose'
    
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id], backref="chat_settings")
    target_user = db.relationship("User", foreign_keys=[target_user_id])
    group = db.relationship("Group", foreign_keys=[group_id])

    def to_dict(self):
        return {
            "read_receipts_enabled": self.read_receipts_enabled,
            "typing_indicators_enabled": self.typing_indicators_enabled,
            "is_muted": self.is_muted,
            "is_pinned": self.is_pinned,
            "theme_color": self.theme_color
        }
