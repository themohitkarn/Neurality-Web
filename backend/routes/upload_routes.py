from flask import Blueprint, request, jsonify
import cloudinary.uploader
from utils.jwt_helper import token_required

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {
    # Images
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    # Videos
    'mp4', 'mov', 'mpeg', 'avi', 'webm',
    # Audio
    'mp3', 'wav', 'm4a', 'ogg',
    # Docs
    'pdf', 'txt', 'doc', 'docx'
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@upload_bp.route("/api/upload", methods=["POST"])
@token_required
def upload_file():
    file = request.files.get("file")

    if not file:
        return jsonify({
            "success": False,
            "message": "No file uploaded"
        }), 400

    filename = file.filename
    if not filename or not allowed_file(filename):
        return jsonify({
            "success": False,
            "message": "File type not allowed."
        }), 400

    # Read a small chunk to verify the file is not empty or overly large in memory
    # Cloudinary also enforces its own limits, but let's do a basic type check.
    content_type = file.content_type or ""
    # Basic sanitize check on mime type
    is_valid_mime = (
        content_type.startswith("image/") or
        content_type.startswith("video/") or
        content_type.startswith("audio/") or
        content_type in ["application/pdf", "text/plain", "application/msword", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    )

    if not is_valid_mime:
        return jsonify({
            "success": False,
            "message": "Invalid file signature/content-type."
        }), 400

    try:
        result = cloudinary.uploader.upload(
            file,
            folder="neurality/chat",
            resource_type="auto"
        )

        return jsonify({
            "success": True,
            "url": result["secure_url"],
            "public_id": result["public_id"]
        })

    except Exception as e:
        # Never log raw exception to response body in production
        return jsonify({
            "success": False,
            "message": "An error occurred while uploading file."
        }), 500