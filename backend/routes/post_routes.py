from sqlalchemy import or_

from flask import Blueprint, g, jsonify, request

from extensions import db
from ml.recommender import recommend_posts_for_user
from models.post import Post
from models.user import User
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import token_required


post_bp = Blueprint("posts", __name__)


@post_bp.post("/create")
@token_required
def create_post():
    caption = (request.form.get("caption") or "").strip()
    image = request.files.get("image")

    if not image or not image.filename:
        return jsonify({"message": "An image is required for every post."}), 400

    try:
        image_path = save_uploaded_image(image, category="posts")
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    try:
        post = Post(user_id=g.current_user.id, image_path=image_path, caption=caption or None)
        db.session.add(post)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        delete_image(image_path)
        return jsonify({"message": f"Unable to create post: {exc}"}), 500

    return jsonify({"message": "Post created successfully.", "post": post.to_dict(g.current_user.id)}), 201


@post_bp.get("/feed")
@token_required
def get_feed():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 10)), 1), 20)

    following_ids = [user.id for user in g.current_user.following.all()]
    feed_user_ids = following_ids + [g.current_user.id]

    query = Post.query
    if feed_user_ids:
        query = query.filter(Post.user_id.in_(feed_user_ids))

    if query.count() == 0:
        query = Post.query.join(User, Post.user_id == User.id).filter(
            or_(User.is_private.is_(False), User.id.in_(feed_user_ids))
        )

    pagination = query.order_by(Post.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "posts": [post.to_dict(current_user_id=g.current_user.id) for post in pagination.items],
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "has_next": pagination.has_next,
        }
    )


@post_bp.post("/like/<int:post_id>")
@token_required
def toggle_like(post_id):
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found."}), 404

    existing_like = g.current_user.liked_posts.filter(Post.id == post.id).first()
    if existing_like:
        g.current_user.liked_posts.remove(post)
        liked = False
        message = "Post unliked."
    else:
        g.current_user.liked_posts.append(post)
        liked = True
        message = "Post liked."

    db.session.commit()

    return jsonify(
        {
            "message": message,
            "liked": liked,
            "likes_count": post.liked_by.count(),
        }
    )


@post_bp.get("/recommended")
@token_required
def get_recommended_posts():
    limit = min(max(int(request.args.get("limit", 6)), 1), 12)
    recommended_posts = recommend_posts_for_user(g.current_user, limit=limit)
    return jsonify({"posts": [post.to_dict(current_user_id=g.current_user.id) for post in recommended_posts]})
