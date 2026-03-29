from collections import OrderedDict
from datetime import datetime

from sqlalchemy import or_

from flask import Blueprint, g, jsonify, request

from extensions import db
from models.story import Story
from models.user import User
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import token_required


story_bp = Blueprint("stories", __name__)


@story_bp.post("/create")
@token_required
def create_story():
    image = request.files.get("image")
    if not image or not image.filename:
        return jsonify({"message": "A story image is required."}), 400

    try:
        image_path = save_uploaded_image(image, category="stories")
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    try:
        story = Story(user_id=g.current_user.id, image_path=image_path)
        db.session.add(story)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        delete_image(image_path)
        return jsonify({"message": f"Unable to create story: {exc}"}), 500

    return jsonify({"message": "Story uploaded successfully.", "story": story.to_dict()}), 201


@story_bp.get("/feed")
@token_required
def get_stories():
    following_ids = [user.id for user in g.current_user.following.all()]
    visible_user_ids = following_ids + [g.current_user.id]

    query = Story.query.filter(Story.expires_at > datetime.utcnow())
    if visible_user_ids:
        query = query.filter(Story.user_id.in_(visible_user_ids))

    if query.count() == 0:
        query = Story.query.join(User, Story.user_id == User.id).filter(
            Story.expires_at > datetime.utcnow(),
            or_(User.is_private.is_(False), User.id.in_(visible_user_ids)),
        )

    active_stories = query.order_by(Story.created_at.desc()).all()

    grouped = OrderedDict()
    for story in active_stories:
        author_id = story.author.id
        story_payload = story.to_dict()
        if author_id not in grouped:
            grouped[author_id] = {
                "user": story_payload["author"],
                "stories": [],
            }
        grouped[author_id]["stories"].append(story_payload)

    return jsonify({"stories": list(grouped.values())})
