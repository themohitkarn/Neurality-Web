from collections import OrderedDict
from datetime import datetime
import json

from sqlalchemy import or_
from flask import Blueprint, g, jsonify, request

from extensions import db
from models.story import Story, StorySeen, StoryReaction
from models.user import User
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import token_required
from sockets.story_socket import handle_story_created


story_bp = Blueprint("stories", __name__)


@story_bp.post("/create")
@token_required
def create_story():
    image = request.files.get("image")
    media_type = request.form.get("media_type", "image")
    caption = request.form.get("caption", "")
    music = request.form.get("music") # Should be JSON string
    text_style = request.form.get("text_style") # Should be JSON string

    if not image or not image.filename:
        return jsonify({"message": "A story media file is required."}), 400

    try:
        # We reuse save_uploaded_image which works for videos too if handled in handler
        image_path = save_uploaded_image(image, category="stories")
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    post_id = request.form.get("post_id")
    reel_id = request.form.get("reel_id")
    is_muted = request.form.get("is_muted") == "true"

    try:
        story = Story(
            user_id=g.current_user.id,
            image_path=image_path,
            media_type=media_type,
            caption=caption,
            music=json.loads(music) if music else None,
            text_style=json.loads(text_style) if text_style else None,
            is_muted=is_muted,
            post_id=int(post_id) if post_id else None,
            reel_id=int(reel_id) if reel_id else None
        )
        db.session.add(story)
        db.session.commit()
        
        story_dict = story.to_dict(current_user_id=g.current_user.id)
        handle_story_created(story_dict)
    except Exception as exc:
        db.session.rollback()
        delete_image(image_path)
        return jsonify({"message": f"Unable to create story: {exc}"}), 500

    return jsonify({"message": "Story uploaded successfully.", "story": story.to_dict(current_user_id=g.current_user.id)}), 201


@story_bp.get("/feed")
@token_required
def get_stories():
    following_ids = [user.id for user in g.current_user.following.all()]
    visible_user_ids = following_ids + [g.current_user.id]

    # Get active stories (not expired)
    query = Story.query.filter(Story.expires_at > datetime.utcnow())
    
    # Filter by following or public users
    query = query.join(User, Story.user_id == User.id).filter(
        or_(
            Story.user_id.in_(visible_user_ids),
            User.is_private.is_(False)
        )
    )

    active_stories = query.order_by(Story.created_at.asc()).all()

    grouped = OrderedDict()
    
    # Ensure current user is first if they have stories
    if any(s.user_id == g.current_user.id for s in active_stories):
        grouped[g.current_user.id] = {
            "user": g.current_user.to_dict(),
            "stories": [],
            "all_seen": True
        }

    for story in active_stories:
        author_id = story.author.id
        story_payload = story.to_dict(current_user_id=g.current_user.id)
        
        if author_id not in grouped:
            grouped[author_id] = {
                "user": story_payload["author"],
                "stories": [],
                "all_seen": True
            }
        
        grouped[author_id]["stories"].append(story_payload)
        if not story_payload["is_seen"]:
            grouped[author_id]["all_seen"] = False

    return jsonify({"stories": list(grouped.values())})


@story_bp.post("/<int:story_id>/seen")
@token_required
def mark_story_seen(story_id):
    story = Story.query.get_or_404(story_id)
    
    existing = StorySeen.query.filter_by(story_id=story_id, user_id=g.current_user.id).first()
    if not existing:
        seen = StorySeen(story_id=story_id, user_id=g.current_user.id)
        db.session.add(seen)
        db.session.commit()
    
    return jsonify({"message": "Story marked as seen."})


@story_bp.post("/<int:story_id>/react")
@token_required
def react_to_story(story_id):
    from routes.notification_routes import create_notification

    emoji = request.json.get("emoji")
    if not emoji:
        return jsonify({"message": "Emoji is required."}), 400
        
    story = Story.query.get_or_404(story_id)
    
    reaction = StoryReaction(story_id=story_id, user_id=g.current_user.id, emoji=emoji)
    db.session.add(reaction)

    create_notification(
        user_id=story.user_id,
        actor_id=g.current_user.id,
        type_="story_reaction",
        target_type="story",
        target_id=story.id,
        body=emoji,
    )

    db.session.commit()
    
    return jsonify({"message": "Reaction added.", "reaction": reaction.to_dict()})


@story_bp.delete("/<int:story_id>")
@token_required
def delete_story(story_id):
    story = Story.query.get_or_404(story_id)
    if story.user_id != g.current_user.id:
        return jsonify({"message": "Unauthorized"}), 403
        
    delete_image(story.image_path)
    db.session.delete(story)
    db.session.commit()
    
    return jsonify({"message": "Story deleted."})
