from flask import Blueprint, request, jsonify
import cloudinary.uploader

upload_bp = Blueprint("upload", __name__)

@upload_bp.route("/api/upload", methods=["POST"])
def upload_file():

    file = request.files.get("file")

    if not file:
        return jsonify({
            "success": False,
            "message": "No file uploaded"
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
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500