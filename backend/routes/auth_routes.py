import re

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_

from extensions import db
from models.user import User
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import generate_token, token_required


auth_bp = Blueprint("auth", __name__)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _get_payload():
    return request.form if request.form else (request.get_json(silent=True) or {})


@auth_bp.post("/signup")
def signup():
    payload = _get_payload()
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    bio = (payload.get("bio") or "").strip()

    if not username or not email or not password:
        return jsonify({"message": "Username, email, and password are required."}), 400

    if len(username) < 3 or len(username) > 50:
        return jsonify({"message": "Username must be between 3 and 50 characters."}), 400

    if not EMAIL_REGEX.match(email):
        return jsonify({"message": "Please provide a valid email address."}), 400

    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters long."}), 400

    existing_user = User.query.filter(
        or_(func.lower(User.username) == username.lower(), func.lower(User.email) == email)
    ).first()
    if existing_user:
        return jsonify({"message": "An account with that username or email already exists."}), 409

    profile_pic_path = None
    if "profile_pic" in request.files and request.files["profile_pic"].filename:
        try:
            profile_pic_path = save_uploaded_image(request.files["profile_pic"], category="avatars")
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400

    try:
        user = User(username=username, email=email, bio=bio or None, profile_pic=profile_pic_path)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        if profile_pic_path:
            delete_image(profile_pic_path)
        return jsonify({"message": f"Unable to create user: {exc}"}), 500

    token = generate_token(user.id)
    return (
        jsonify(
            {
                "message": "Signup successful.",
                "token": token,
                "user": user.to_dict(viewer_id=user.id, include_email=True, include_settings=True),
            }
        ),
        201,
    )


@auth_bp.post("/login")
def login():
    payload = _get_payload()
    identifier = (payload.get("identifier") or payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not identifier or not password:
        return jsonify({"message": "Email or username and password are required."}), 400

    user = User.query.filter(
        or_(func.lower(User.email) == identifier.lower(), func.lower(User.username) == identifier.lower())
    ).first()

    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid credentials."}), 401

    token = generate_token(user.id)
    return jsonify(
        {
            "message": "Login successful.",
            "token": token,
            "user": user.to_dict(viewer_id=user.id, include_email=True, include_settings=True),
        }
    )


@auth_bp.get("/me")
@token_required
def me():
    return jsonify(
        {
            "user": g.current_user.to_dict(
                viewer_id=g.current_user.id,
                include_email=True,
                include_settings=True,
            )
        }
    )


@auth_bp.post("/change-password")
@token_required
def change_password():
    payload = _get_payload()
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"message": "Current and new passwords are required."}), 400

    if not g.current_user.check_password(current_password):
        return jsonify({"message": "Current password is incorrect."}), 401

    if len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters."}), 400

    g.current_user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password changed successfully."})


@auth_bp.post("/delete-account")
@token_required
def delete_account():
    payload = _get_payload()
    password = payload.get("password") or ""

    if not g.current_user.check_password(password):
        return jsonify({"message": "Password is incorrect."}), 401

    db.session.delete(g.current_user)
    db.session.commit()
    return jsonify({"message": "Account deleted successfully."})
