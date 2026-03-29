import subprocess
from pathlib import Path
from uuid import uuid4

from flask import current_app, has_request_context, url_for
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


ALLOWED_VIDEO_EXTENSIONS = {
    "mp4",
    "mov",
    "m4v",
    "webm",
    "mkv",
    "avi",
    "mpeg",
    "mpg",
    "3gp",
    "ogv",
}
ALLOWED_VIDEO_MIME_PREFIXES = ("video/",)


def ensure_video_structure(app=None):
    target_app = app or current_app
    for folder_key in ("VIDEO_FOLDER", "REEL_VIDEO_FOLDER", "VIDEO_THUMBNAIL_FOLDER", "VIDEO_TEMP_FOLDER"):
        Path(target_app.config[folder_key]).mkdir(parents=True, exist_ok=True)


def allowed_video_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS


def build_video_url(relative_path):
    if not relative_path:
        return None

    normalized_path = relative_path.replace("\\", "/")
    if has_request_context():
        return url_for("static", filename=f"videos/{normalized_path}", _external=True)

    return f"/static/videos/{normalized_path}"


def delete_video(relative_path):
    if not relative_path:
        return

    target = Path(current_app.config["VIDEO_FOLDER"]) / relative_path
    if target.exists():
        target.unlink()


def _uploaded_size_mb(file_storage: FileStorage):
    stream = file_storage.stream
    current_position = stream.tell()
    stream.seek(0, 2)
    size_bytes = stream.tell()
    stream.seek(current_position)
    return size_bytes / (1024 * 1024)


def _probe_duration_seconds(video_path: Path):
    probe_command = [
        current_app.config["FFPROBE_BINARY"],
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    result = subprocess.run(probe_command, check=True, capture_output=True, text=True)
    return float((result.stdout or "0").strip() or 0)


def process_uploaded_video(file_storage: FileStorage):
    if not file_storage or not file_storage.filename:
        raise ValueError("Please choose a video file.")

    filename = secure_filename(file_storage.filename)
    if not allowed_video_file(filename):
        raise ValueError("Unsupported video type. Allowed types: mp4, mov, m4v, webm.")

    mimetype = file_storage.mimetype or ""
    if not (mimetype.startswith(ALLOWED_VIDEO_MIME_PREFIXES) or mimetype in {"application/octet-stream", "binary/octet-stream"}):
        raise ValueError("Only video uploads are allowed for reels.")

    upload_size_mb = _uploaded_size_mb(file_storage)
    max_upload_mb = current_app.config["MAX_VIDEO_UPLOAD_MB"]
    if upload_size_mb > max_upload_mb:
        raise ValueError(f"Videos must be {max_upload_mb}MB or smaller.")

    temp_folder = Path(current_app.config["VIDEO_TEMP_FOLDER"])
    reel_folder = Path(current_app.config["REEL_VIDEO_FOLDER"])
    thumbnail_folder = Path(current_app.config["VIDEO_THUMBNAIL_FOLDER"])

    temp_folder.mkdir(parents=True, exist_ok=True)
    reel_folder.mkdir(parents=True, exist_ok=True)
    thumbnail_folder.mkdir(parents=True, exist_ok=True)

    temp_extension = filename.rsplit(".", 1)[1].lower()
    token = uuid4().hex
    temp_path = temp_folder / f"{token}.{temp_extension}"
    output_video_path = reel_folder / f"{token}.mp4"
    output_thumbnail_path = thumbnail_folder / f"{token}.jpg"

    file_storage.save(temp_path)

    compress_command = [
        current_app.config["FFMPEG_BINARY"],
        "-y",
        "-i",
        str(temp_path),
        "-vf",
        "scale='min(720,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_video_path),
    ]
    thumbnail_command = [
        current_app.config["FFMPEG_BINARY"],
        "-y",
        "-i",
        str(output_video_path),
        "-ss",
        "00:00:00.500",
        "-vframes",
        "1",
        str(output_thumbnail_path),
    ]

    try:
        duration_seconds = _probe_duration_seconds(temp_path)
        if duration_seconds > current_app.config["MAX_VIDEO_DURATION_SECONDS"]:
            max_minutes = current_app.config["MAX_VIDEO_DURATION_SECONDS"] // 60
            raise ValueError(f"Reels can be up to {max_minutes} minutes long.")

        subprocess.run(compress_command, check=True, capture_output=True, text=True)
        subprocess.run(thumbnail_command, check=True, capture_output=True, text=True)
    except ValueError:
        if output_video_path.exists():
            output_video_path.unlink()
        if output_thumbnail_path.exists():
            output_thumbnail_path.unlink()
        raise
    except FileNotFoundError as exc:
        raise ValueError("ffmpeg/ffprobe is required to upload reels, but it was not found on this server.") from exc
    except subprocess.CalledProcessError as exc:
        if output_video_path.exists():
            output_video_path.unlink()
        if output_thumbnail_path.exists():
            output_thumbnail_path.unlink()
        stderr_output = exc.stderr.strip() or "Unknown ffmpeg error."
        raise ValueError(f"ffmpeg could not process the uploaded reel: {stderr_output}") from exc
    finally:
        if temp_path.exists():
            temp_path.unlink()

    return {
        "video_path": f"reels/{output_video_path.name}",
        "thumbnail_path": f"thumbnails/{output_thumbnail_path.name}",
    }
