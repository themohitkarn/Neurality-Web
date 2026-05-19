import cloudinary.uploader
import cloudinary.api
from pathlib import Path
from uuid import uuid4
from flask import current_app

def upload_video_to_cloudinary(file_storage, folder="neurality/reels"):
    filename = getattr(file_storage, "filename", "") or ""
    ext = Path(filename).suffix.lower()
    ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".jpg", ".jpeg", ".png", ".webp"}
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension: {ext}")

    mimetype = getattr(file_storage, "mimetype", "") or ""
    if not (mimetype.startswith("video/") or mimetype.startswith("image/")):
        raise ValueError(f"Invalid file MIME type: {mimetype}")

    try:

        result = cloudinary.uploader.upload_large(
            file_storage.stream,
            folder=folder,
            resource_type="video",
            chunk_size=6000000,

            transformation=[
                {
                    "quality": "auto",
                    "fetch_format": "auto"
                }
            ]
        )

        return {
            "video_url": result["secure_url"],
            "public_id": result["public_id"],
            "thumbnail_url": result["secure_url"].replace(".mp4", ".jpg")
        }

    except Exception as e:
        raise ValueError(f"Cloudinary upload failed: {str(e)}")

def delete_video_from_cloudinary(public_id):
    """
    Deletes a video and its derived resources from Cloudinary.
    """
    try:
        cloudinary.uploader.destroy(public_id, resource_type="video")
    except Exception as e:
        print(f"Failed to delete Cloudinary asset {public_id}: {e}")
