from sqlalchemy import or_

from flask import Blueprint, g, jsonify, request

from extensions import db
from ml.recommender import recommend_posts_for_user
from models.post import Post
from models.user import User
from models.social import PostImage
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import token_required


post_bp = Blueprint("posts", __name__)


@post_bp.post("/create")
@token_required
def create_post():
    caption = (request.form.get("caption") or "").strip()
    media_type = request.form.get("media_type", "image")
    is_muted = request.form.get("is_muted") == "true"
    location = request.form.get("location", "")
    width = request.form.get("width")
    height = request.form.get("height")
    aspect_ratio = request.form.get("aspect_ratio")
    orientation = request.form.get("orientation")

    # Support both single 'image' and multiple 'images' fields
    images = request.files.getlist("images")
    single = request.files.get("image")
    if single and single.filename:
        images = [single] + [f for f in images if f.filename]
    else:
        images = [f for f in images if f.filename]

    if not images:
        return jsonify({"message": "At least one media file is required."}), 400

    # Save the first image as the primary (backwards compatible)
    saved_paths = []
    try:
        for img_file in images:
            path = save_uploaded_image(img_file, category="posts")
            saved_paths.append(path)
    except ValueError as exc:
        for p in saved_paths:
            delete_image(p)
        return jsonify({"message": str(exc)}), 400

    # Save audio if present
    audio_path = None
    audio_file = request.files.get("audio")
    if audio_file and audio_file.filename:
        try:
            audio_path = save_uploaded_image(audio_file, category="posts")
        except ValueError as exc:
            for p in saved_paths:
                delete_image(p)
            return jsonify({"message": f"Audio upload error: {exc}"}), 400

    try:
        post = Post(
            user_id=g.current_user.id,
            image_path=saved_paths[0],
            audio_path=audio_path,
            media_type=media_type,
            width=int(width) if width else None,
            height=int(height) if height else None,
            aspect_ratio=aspect_ratio,
            orientation=orientation,
            is_muted=is_muted,
            caption=caption or None,
        )
        db.session.add(post)
        db.session.flush()  # Get post.id before adding carousel images

        # If multiple images, create carousel entries
        if len(saved_paths) > 1:
            for idx, path in enumerate(saved_paths):
                carousel_img = PostImage(
                    post_id=post.id,
                    image_path=path,
                    media_type="image",
                    position=idx,
                )
                db.session.add(carousel_img)

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        for p in saved_paths:
            delete_image(p)
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
    from routes.notification_routes import create_notification

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
        create_notification(
            user_id=post.user_id,
            actor_id=g.current_user.id,
            type_="like",
            target_type="post",
            target_id=post.id,
        )

    db.session.commit()

    return jsonify(
        {
            "message": message,
            "liked": liked,
            "likes_count": post.liked_by.count(),
        }
    )


@post_bp.post("/repost/<int:post_id>")
@token_required
def toggle_repost_post(post_id):
    from routes.notification_routes import create_notification

    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"message": "Post not found."}), 404

    existing_repost = g.current_user.reposted_posts.filter(Post.id == post.id).first()
    if existing_repost:
        g.current_user.reposted_posts.remove(post)
        reposted = False
        message = "Post removed from reposts."
    else:
        g.current_user.reposted_posts.append(post)
        reposted = True
        message = "Post reposted."
        create_notification(
            user_id=post.user_id,
            actor_id=g.current_user.id,
            type_="repost",
            target_type="post",
            target_id=post.id,
        )

    db.session.commit()

    return jsonify(
        {
            "message": message,
            "reposted": reposted,
            "reposts_count": post.reposted_by.count(),
        }
    )


@post_bp.get("/recommended")
@token_required
def get_recommended_posts():
    limit = min(max(int(request.args.get("limit", 6)), 1), 12)
    recommended_posts = recommend_posts_for_user(g.current_user, limit=limit)
    return jsonify({"posts": [post.to_dict(current_user_id=g.current_user.id) for post in recommended_posts]})
