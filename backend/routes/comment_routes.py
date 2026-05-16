from flask import Blueprint, g, jsonify, request

from extensions import db
from models.comment import Comment
from models.post import Post
from utils.jwt_helper import token_required


comment_bp = Blueprint("comments", __name__)


@comment_bp.post("/add")
@token_required
def add_comment():
    payload = request.get_json(silent=True) or {}
    post_id = payload.get("post_id")
    content = (payload.get("content") or "").strip()

    if not post_id or not content:
        return jsonify({"message": "post_id and content are required."}), 400

    if len(content) > 280:
        return jsonify({"message": "Comments must be 280 characters or fewer."}), 400

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found."}), 404

    comment = Comment(post_id=post.id, user_id=g.current_user.id, content=content)
    db.session.add(comment)

    from routes.notification_routes import create_notification
    create_notification(
        user_id=post.user_id,
        actor_id=g.current_user.id,
        type_="comment",
        target_type="post",
        target_id=post.id,
        body=content[:100],
    )

    db.session.commit()

    return jsonify({"message": "Comment added.", "comment": comment.to_dict(g.current_user.id)}), 201


@comment_bp.delete("/<int:comment_id>")
@token_required
def delete_comment(comment_id):
    comment = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"message": "Comment not found."}), 404

    if comment.user_id != g.current_user.id:
        return jsonify({"message": "You can only delete your own comments."}), 403

    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted successfully."})
