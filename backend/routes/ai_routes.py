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
