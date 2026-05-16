from routes.admin_routes import admin_bp
from routes.ai_routes import ai_bp
from routes.auth_routes import auth_bp
from routes.comment_routes import comment_bp
from routes.follow_routes import follow_bp, relationship_bp
from routes.chat_request_routes import chat_request_bp
from routes.highlight_routes import highlight_bp
from routes.notification_routes import notification_bp
from routes.post_routes import post_bp
from routes.reel_routes import reel_bp
from routes.social_routes import social_bp
from routes.story_routes import story_bp
from routes.user_routes import user_bp
from routes.share_routes import share_bp


__all__ = [
    "admin_bp",
    "auth_bp",
    "post_bp",
    "user_bp",
    "comment_bp",
    "story_bp",
    "ai_bp",
    "reel_bp",
    "follow_bp",
    "relationship_bp",
    "notification_bp",
    "social_bp",
    "highlight_bp",
    "share_bp",
    "chat_request_bp",
]
