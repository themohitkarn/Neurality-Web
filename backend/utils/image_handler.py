import imghdr
from pathlib import Path
from uuid import uuid4

from flask import current_app, has_request_context, url_for
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "m4v", "webm", "ogg", "opus", "mp3", "wav"}
ALLOWED_MIME_PREFIXES = ("image/", "video/", "audio/")
ALLOWED_IMAGE_TYPES = {"jpeg", "png", "gif", "webp"}


def ensure_upload_structure(app=None):
    target_app = app or current_app
    for folder_key in ("UPLOAD_FOLDER", "AVATAR_FOLDER", "POST_FOLDER", "STORY_FOLDER"):
        Path(target_app.config[folder_key]).mkdir(parents=True, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_image(file_storage: FileStorage, category="posts"):
    if not file_storage or not file_storage.filename:
        raise ValueError("Please select a media file.")

    filename = secure_filename(file_storage.filename)
    if not allowed_file(filename):
        raise ValueError("Unsupported file type. Allowed types: jpg, jpeg, png, gif, webp, mp4, mov, webm.")

    mimetype = file_storage.mimetype or ""
    if not mimetype.startswith(ALLOWED_MIME_PREFIXES):
        raise ValueError("Only image and video uploads are allowed.")

    is_video = mimetype.startswith("video/")
    is_audio = mimetype.startswith("audio/")
    
    # For images, we do extra validation with imghdr
    if not is_video and not is_audio:
        header_bytes = file_storage.stream.read(512)
        file_storage.stream.seek(0)
        detected_type = imghdr.what(None, header_bytes)
        if detected_type not in ALLOWED_IMAGE_TYPES:
            raise ValueError("The uploaded file is not a valid image.")

    category_map = {
        "avatars": current_app.config["AVATAR_FOLDER"],
        "posts": current_app.config["POST_FOLDER"],
        "stories": current_app.config["STORY_FOLDER"],
    }
    target_folder = Path(category_map.get(category, current_app.config["POST_FOLDER"]))
    target_folder.mkdir(parents=True, exist_ok=True)

    extension = filename.rsplit(".", 1)[1].lower()
    generated_name = f"{uuid4().hex}.{extension}"
    destination = target_folder / generated_name
    file_storage.save(destination)

    return f"{category}/{generated_name}"


def delete_image(relative_path):
    if not relative_path:
        return

    file_path = Path(current_app.config["UPLOAD_FOLDER"]) / relative_path
    if file_path.exists():
        file_path.unlink()


def build_media_url(relative_path):
    if not relative_path:
        return None

    normalized_path = relative_path.replace("\\", "/")
    if has_request_context():
        return url_for("static", filename=f"uploads/{normalized_path}", _external=True)

    return f"/static/uploads/{normalized_path}"

save_image = save_uploaded_image