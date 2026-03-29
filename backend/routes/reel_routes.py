from sqlalchemy import or_

from flask import Blueprint, g, jsonify, request

from extensions import db
from models.reel import Reel
from models.user import User
from utils.jwt_helper import token_required
from utils.video_handler import delete_video, process_uploaded_video


reel_bp = Blueprint("reels", __name__)


@reel_bp.post("/upload")
@token_required
def upload_reel():
    caption = (request.form.get("caption") or "").strip()
    video = request.files.get("video")

    if not video or not video.filename:
        return jsonify({"message": "A video file is required for reels."}), 400

    try:
        processed_assets = process_uploaded_video(video)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    try:
        reel = Reel(
            user_id=g.current_user.id,
            video_path=processed_assets["video_path"],
            thumbnail_path=processed_assets["thumbnail_path"],
            caption=caption or None,
        )
        db.session.add(reel)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        delete_video(processed_assets["video_path"])
        delete_video(processed_assets["thumbnail_path"])
        return jsonify({"message": f"Unable to upload reel: {exc}"}), 500

    return jsonify({"message": "Reel uploaded successfully.", "reel": reel.to_dict(g.current_user.id)}), 201


@reel_bp.get("/feed")
@token_required
def get_reel_feed():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 6)), 1), 12)

    following_ids = [user.id for user in g.current_user.following.all()]
    feed_user_ids = following_ids + [g.current_user.id]

    query = Reel.query
    if feed_user_ids:
        query = query.filter(Reel.user_id.in_(feed_user_ids))

    if query.count() == 0:
        query = Reel.query.join(User, Reel.user_id == User.id).filter(
            or_(User.is_private.is_(False), User.id.in_(feed_user_ids))
        )

    pagination = query.order_by(Reel.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "reels": [reel.to_dict(current_user_id=g.current_user.id) for reel in pagination.items],
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "has_next": pagination.has_next,
        }
    )


@reel_bp.post("/like/<int:reel_id>")
@token_required
def toggle_reel_like(reel_id):
    reel = db.session.get(Reel, reel_id)
    if not reel:
        return jsonify({"message": "Reel not found."}), 404

    existing_like = g.current_user.liked_reels.filter(Reel.id == reel.id).first()
    if existing_like:
        g.current_user.liked_reels.remove(reel)
        liked = False
        message = "Reel unliked."
    else:
        g.current_user.liked_reels.append(reel)
        liked = True
        message = "Reel liked."

    db.session.commit()

    return jsonify(
        {
            "message": message,
            "liked": liked,
            "likes_count": reel.liked_by.count(),
        }
    )
