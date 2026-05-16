from flask import Blueprint, g, jsonify, request

from extensions import db
from models.social import CloseFriend, StoryHighlight, StoryHighlightItem
from models.story import Story
from utils.image_handler import build_media_url, save_uploaded_image
from utils.jwt_helper import token_required


highlight_bp = Blueprint("highlights", __name__)


# ─── Story Highlights ───


@highlight_bp.post("/create")
@token_required
def create_highlight():
    title = (request.form.get("title") or "").strip()
    if not title:
        return jsonify({"message": "Highlight title is required."}), 400

    cover = request.files.get("cover")
    cover_path = None
    if cover and cover.filename:
        try:
            cover_path = save_uploaded_image(cover, category="stories")
        except ValueError:
            pass

    highlight = StoryHighlight(
        user_id=g.current_user.id,
        title=title,
        cover_image=cover_path,
    )
    db.session.add(highlight)
    db.session.commit()

    return jsonify({"message": "Highlight created.", "highlight": highlight.to_dict()}), 201


@highlight_bp.post("/<int:highlight_id>/add")
@token_required
def add_to_highlight(highlight_id):
    highlight = db.session.get(StoryHighlight, highlight_id)
    if not highlight or highlight.user_id != g.current_user.id:
        return jsonify({"message": "Highlight not found."}), 404

    data = request.get_json(silent=True) or {}
    story_ids = data.get("story_ids", [])

    if not story_ids:
        return jsonify({"message": "Provide story_ids to add."}), 400

    added = 0
    for story_id in story_ids:
        story = db.session.get(Story, story_id)
        if story and story.user_id == g.current_user.id:
            existing = StoryHighlightItem.query.filter_by(
                highlight_id=highlight_id, story_id=story_id
            ).first()
            if not existing:
                item = StoryHighlightItem(
                    highlight_id=highlight_id,
                    story_id=story_id,
                    position=highlight.items.count(),
                )
                db.session.add(item)
                added += 1

    db.session.commit()
    return jsonify({"message": f"Added {added} stories to highlight.", "highlight": highlight.to_dict()})


@highlight_bp.get("/user/<int:user_id>")
@token_required
def get_user_highlights(user_id):
    highlights = StoryHighlight.query.filter_by(user_id=user_id).order_by(StoryHighlight.created_at.asc()).all()
    return jsonify({"highlights": [h.to_dict() for h in highlights]})


@highlight_bp.get("/<int:highlight_id>/stories")
@token_required
def get_highlight_stories(highlight_id):
    highlight = db.session.get(StoryHighlight, highlight_id)
    if not highlight:
        return jsonify({"message": "Highlight not found."}), 404

    items = highlight.items.order_by(StoryHighlightItem.position.asc()).all()
    stories = []
    for item in items:
        if item.story:
            stories.append(item.story.to_dict(current_user_id=g.current_user.id))

    return jsonify({
        "highlight": highlight.to_dict(),
        "stories": stories,
    })


@highlight_bp.delete("/<int:highlight_id>")
@token_required
def delete_highlight(highlight_id):
    highlight = db.session.get(StoryHighlight, highlight_id)
    if not highlight or highlight.user_id != g.current_user.id:
        return jsonify({"message": "Highlight not found."}), 404

    db.session.delete(highlight)
    db.session.commit()
    return jsonify({"message": "Highlight deleted."})


# ─── Close Friends ───


@highlight_bp.post("/close-friends/<int:friend_id>")
@token_required
def toggle_close_friend(friend_id):
    if friend_id == g.current_user.id:
        return jsonify({"message": "You can't add yourself."}), 400

    existing = CloseFriend.query.filter_by(
        user_id=g.current_user.id, friend_id=friend_id
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"message": "Removed from close friends.", "is_close_friend": False})
    else:
        cf = CloseFriend(user_id=g.current_user.id, friend_id=friend_id)
        db.session.add(cf)
        db.session.commit()
        return jsonify({"message": "Added to close friends.", "is_close_friend": True})


@highlight_bp.get("/close-friends")
@token_required
def list_close_friends():
    from models.user import User

    friends = CloseFriend.query.filter_by(user_id=g.current_user.id).all()
    result = []
    for cf in friends:
        friend = db.session.get(User, cf.friend_id)
        if friend:
            result.append({
                "id": friend.id,
                "username": friend.username,
                "full_name": friend.full_name or "",
                "profile_pic": build_media_url(friend.profile_pic),
            })

    return jsonify({"close_friends": result})
