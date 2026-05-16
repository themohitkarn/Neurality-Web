from flask import Blueprint, jsonify, request

from utils.ai_caption_service import CaptionGenerationError, generate_caption_suggestions
from utils.image_handler import allowed_file
from utils.jwt_helper import token_required


ai_bp = Blueprint("ai", __name__)


def _get_payload():
    return request.form if request.form else (request.get_json(silent=True) or {})


@ai_bp.post("/caption")
@token_required
def generate_caption():
    payload = _get_payload()
    prompt = (payload.get("prompt") or "").strip()
    image = request.files.get("image")

    if image and image.filename:
        if not allowed_file(image.filename):
            return jsonify({"message": "Unsupported image type for AI caption generation."}), 400
        if not (image.mimetype or "").startswith("image/"):
            return jsonify({"message": "Only image files can be used for AI captions."}), 400

    try:
        suggestions = generate_caption_suggestions(prompt=prompt or None, image_file=image)
    except CaptionGenerationError as exc:
        return jsonify({"message": str(exc)}), exc.status_code

    return jsonify(suggestions)


@ai_bp.post("/edit-suggestions")
@token_required
def get_edit_suggestions():
    image = request.files.get("image")
    if not image or not image.filename:
        return jsonify({"message": "Choose an image for AI analysis."}), 400

    try:
        # Reusing the service but with a different prompt intent
        from utils.ai_caption_service import generate_image_edit_advice
        suggestions = generate_image_edit_advice(image)
        return jsonify(suggestions)
    except Exception as exc:
        return jsonify({"message": str(exc)}), 500
@ai_bp.post("/suggest-replies")
@token_required
def suggest_replies():
    payload = _get_payload()
    context = payload.get("context", []) # Last few messages
    
    # Futuristic logic: find the intent of the last message
    if not context:
        return jsonify(["Hey!", "How's it going?", "What's up?"])
    
    last_msg = context[-1].get("content", "").lower()
    
    if "how are you" in last_msg or "how's it going" in last_msg:
        return jsonify(["I'm doing great, you?", "Doing well!", "Not bad, how about you?"])
    elif "where are you" in last_msg:
        return jsonify(["At home", "On my way!", "Just finished work"])
    elif "?" in last_msg:
        return jsonify(["I'll check!", "Not sure yet", "Let me get back to you"])
    
    return jsonify(["Haha true!", "Wow", "Interesting!"])


@ai_bp.post("/process-message")
def process_message():
    """
    Internal/Worker endpoint to process messages for AI insights, 
    moderation, or smart suggestions.
    """
    data = request.get_json() or {}
    message_content = data.get("content", "")
    sender_id = data.get("sender_id")
    
    # Placeholder for futuristic AI logic
    # In a real app, this would call Gemini/GPT to analyze intent
    return jsonify({
        "status": "processed",
        "moderation": "clean",
        "sentiment": "neutral",
        "suggestions": ["Love it!", "That's cool", "Tell me more"]
    })
