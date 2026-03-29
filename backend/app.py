from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify
from werkzeug.exceptions import RequestEntityTooLarge

from config import Config
from extensions import bcrypt, cors, db, socketio
from models import Comment, FollowRequest, Message, MessageRequest, Post, Story, User
from routes import (
    ai_bp,
    auth_bp,
    chat_bp,
    comment_bp,
    follow_bp,
    post_bp,
    reel_bp,
    relationship_bp,
    story_bp,
    user_bp,
)

from sockets import register_chat_socket_handlers
from utils.image_handler import ensure_upload_structure
from utils.runtime_migrations import ensure_runtime_schema
from utils.video_handler import ensure_video_structure


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config.from_object(Config)

    db.init_app(app)
    bcrypt.init_app(app)

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=False,
    )

    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        async_mode="threading",
    )

    ensure_upload_structure(app)
    ensure_video_structure(app)

    register_chat_socket_handlers(socketio)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(relationship_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(follow_bp, url_prefix="/api/follow")
    app.register_blueprint(post_bp, url_prefix="/api/posts")
    app.register_blueprint(reel_bp, url_prefix="/api/reels")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
    app.register_blueprint(comment_bp, url_prefix="/api/comments")
    app.register_blueprint(story_bp, url_prefix="/api/stories")

    with app.app_context():
        db.create_all()
        ensure_runtime_schema()

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
    )
