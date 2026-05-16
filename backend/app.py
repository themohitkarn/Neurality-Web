from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge
from config.cloudinary_config import *
from routes.upload_routes import upload_bp

from config import Config
from extensions import bcrypt, cors, db, socketio
from flask_cors import CORS
from models import Comment, FollowRequest, MessageRequest, Post, Story, User
from routes import (
    admin_bp,
    ai_bp,
    auth_bp,
    chat_request_bp,
    comment_bp,
    follow_bp,
    highlight_bp,
    notification_bp,
    post_bp,
    reel_bp,
    relationship_bp,
    share_bp,
    social_bp,
    story_bp,
    user_bp,
)

from utils.image_handler import ensure_upload_structure
from utils.video_handler import ensure_video_structure


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.url_map.strict_slashes = False
    app.config.from_object(Config)

    db.init_app(app)
    bcrypt.init_app(app)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", ["*"])}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"]
    )

    

    @app.before_request
    def log_request_info():
        app.logger.info('Headers: %s', request.headers)
        app.logger.info('Body: %s', request.get_data())

    socketio.init_app(
        app,
        cors_allowed_origins="*",
        
    )

    ensure_upload_structure(app)
    ensure_video_structure(app)

    # register_chat_socket_handlers(socketio)
    app.register_blueprint(upload_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(relationship_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(follow_bp, url_prefix="/api/follow")
    app.register_blueprint(post_bp, url_prefix="/api/posts")
    app.register_blueprint(reel_bp, url_prefix="/api/reels")
    app.register_blueprint(comment_bp, url_prefix="/api/comments")
    app.register_blueprint(story_bp, url_prefix="/api/stories")
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(chat_request_bp, url_prefix="/api/chat")
    app.register_blueprint(social_bp, url_prefix="/api/social")
    app.register_blueprint(highlight_bp, url_prefix="/api/highlights")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(share_bp, url_prefix="/api/share")

    with app.app_context():
        # Schema is managed by Prisma. No db.create_all() or runtime migrations.
        pass

    @app.get("/api/health")
    def health_check():
        return jsonify({"status": "ok", "service": "Neurality API"})

    @app.errorhandler(RequestEntityTooLarge)
    def handle_large_file(_error):
        max_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify({"message": f"File is too large. Maximum size is {max_mb}MB."}), 413

    return app


app = create_app()


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
