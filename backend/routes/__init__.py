from routes.ai_routes import ai_bp
from routes.auth_routes import auth_bp
from routes.chat_routes import chat_bp
from routes.comment_routes import comment_bp
from routes.follow_routes import follow_bp, relationship_bp
from routes.post_routes import post_bp
from routes.reel_routes import reel_bp
from routes.story_routes import story_bp
from routes.user_routes import user_bp


__all__ = [
    "auth_bp",
    "post_bp",
    "user_bp",
    "comment_bp",
    "story_bp",
    "ai_bp",
    "reel_bp",
    "chat_bp",
    "follow_bp",
    "relationship_bp",
]
