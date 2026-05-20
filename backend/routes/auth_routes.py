import re
import random
from datetime import datetime, timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_

from extensions import db, limiter
from models.user import User
from models.otp_verification import OtpVerification
from models.device_session import DeviceSession
from utils.image_handler import delete_image, save_uploaded_image
from utils.jwt_helper import generate_access_token, generate_refresh_token_in_db, token_required
from utils.otp_helper import generate_and_dispatch_otp, hash_otp
from utils.device_helper import parse_device_name, get_device_location


auth_bp = Blueprint("auth", __name__)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _get_payload():
    return request.form if request.form else (request.get_json(silent=True) or {})


@auth_bp.post("/signup")
@limiter.limit("5 per minute")
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
        func.lower(User.username) == username.lower()
    ).first()
    if existing_user:
        return jsonify({"message": "An account with that username already exists."}), 409

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

    client_ip = get_client_ip()
    user_agent = request.headers.get("User-Agent", "")
    device_name = parse_device_name(user_agent)
    location = get_device_location(client_ip)

    session = DeviceSession(
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        device_name=device_name,
        location=location
    )
    db.session.add(session)
    db.session.commit()

    access_token = generate_access_token(user.id, session_id=session.id)
    refresh_token = generate_refresh_token_in_db(user.id, session_id=session.id)

    response = jsonify(
        {
            "message": "Signup successful.",
            "token": access_token,
            "user": user.to_dict(viewer_id=user.id, include_email=True, include_settings=True),
        }
    )
    if refresh_token:
        response.set_cookie(
            "refresh_token",
            refresh_token,
            httponly=True,
            secure=True,
            samesite="None",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
    return response, 201


def get_client_ip():
    if request.headers.get("CF-Connecting-IP"):
        return request.headers.get("CF-Connecting-IP")
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    if request.headers.get("X-Real-IP"):
        return request.headers.get("X-Real-IP")
    return request.remote_addr

@auth_bp.post("/login")
@limiter.limit("5 per minute")
def login():
    payload = _get_payload()
    identifier = (payload.get("identifier") or payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not identifier or not password:
        return jsonify({"message": "Email or username and password are required."}), 400

    user = User.query.filter(
        or_(func.lower(User.email) == identifier.lower(), func.lower(User.username) == identifier.lower(), User.phone_number == identifier)
    ).first()

    if not user:
        return jsonify({"message": "Invalid credentials."}), 401

    if not user.check_password(password):
        user.failed_login_attempts += 1
        db.session.commit()
        return jsonify({"message": "Invalid credentials."}), 401

    client_ip = get_client_ip()
    user_agent = request.headers.get("User-Agent", "")

    # Strict New Device Verification
    has_sessions = DeviceSession.query.filter_by(user_id=user.id).count() > 0
    is_recognized = False
    active_session_id = None

    if has_sessions:
        matching_session = DeviceSession.query.filter_by(user_id=user.id, user_agent=user_agent).first()
        if matching_session:
            is_recognized = True
            matching_session.ip_address = client_ip
            matching_session.location = get_device_location(client_ip)
            matching_session.last_active = datetime.utcnow()
            db.session.commit()
            active_session_id = matching_session.id
    else:
        # First session for this user is automatically recognized
        is_recognized = True
        device_name = parse_device_name(user_agent)
        location = get_device_location(client_ip)
        new_session = DeviceSession(
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            device_name=device_name,
            location=location
        )
        db.session.add(new_session)
        db.session.commit()
        active_session_id = new_session.id

    if not is_recognized:
        device_info = {
            "ip": client_ip,
            "device": parse_device_name(request.headers.get("User-Agent", "")),
            "location": get_device_location(client_ip)
        }
        
        res = generate_and_dispatch_otp(identifier, "new_device_login", device_info)
        if not res.get("success") and res.get("status_code") != 200:
            return jsonify({"message": res.get("message", "Unable to send verification code.")}), res.get("status_code", 400)
        
        return jsonify({
            "message": "New device detected. Please verify your login.",
            "requires_verification": True,
            "identifier": identifier
        }), 202

    user.last_ip = client_ip
    user.last_login = datetime.utcnow()
    user.failed_login_attempts = 0
    db.session.commit()

    access_token = generate_access_token(user.id, session_id=active_session_id)
    refresh_token = generate_refresh_token_in_db(user.id, session_id=active_session_id)

    response = jsonify(
        {
            "message": "Login successful.",
            "token": access_token,
            "user": user.to_dict(viewer_id=user.id, include_email=True, include_settings=True),
        }
    )
    if refresh_token:
        response.set_cookie(
            "refresh_token",
            refresh_token,
            httponly=True,
            secure=True,
            samesite="None",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
    return response

@auth_bp.post("/login-verify")
@limiter.limit("5 per minute")
def login_verify():
    payload = _get_payload()
    identifier = (payload.get("identifier") or "").strip()
    otp = (payload.get("otp") or "").strip()
    
    if not identifier or not otp:
        return jsonify({"message": "Identifier and OTP are required."}), 400

    verification = OtpVerification.query.filter_by(
        identifier=identifier, purpose="new_device_login", is_verified=False
    ).order_by(OtpVerification.created_at.desc()).first()

    if not verification:
        return jsonify({"message": "No pending verification code found."}), 404

    if verification.expires_at < datetime.utcnow():
        return jsonify({"message": "Verification code has expired."}), 400

    if verification.attempts >= 5:
        return jsonify({"message": "Verification code locked due to too many failed attempts. Please request a new code."}), 429

    # Compare hashed OTP
    if verification.otp != hash_otp(otp):
        verification.attempts += 1
        db.session.commit()
        remaining = 5 - verification.attempts
        return jsonify({"message": f"Invalid verification code. {remaining} attempts remaining." if remaining > 0 else "Code locked due to too many failed attempts."}), 400

    verification.is_verified = True
    user = User.query.filter(
        or_(func.lower(User.email) == identifier.lower(), func.lower(User.username) == identifier.lower(), User.phone_number == identifier)
    ).first()

    if not user:
        return jsonify({"message": "User not found."}), 404

    client_ip = get_client_ip()
    user_agent = request.headers.get("User-Agent", "")
    device_name = parse_device_name(user_agent)
    location = get_device_location(client_ip)

    # Avoid creating duplicate sessions for the same user agent
    session = DeviceSession.query.filter_by(user_id=user.id, user_agent=user_agent).first()
    if not session:
        session = DeviceSession(
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            device_name=device_name,
            location=location
        )
        db.session.add(session)
    else:
        session.ip_address = client_ip
        session.location = location
        session.last_active = datetime.utcnow()

    user.last_ip = client_ip
    user.last_login = datetime.utcnow()
    user.failed_login_attempts = 0
    db.session.commit()

    access_token = generate_access_token(user.id, session_id=session.id)
    refresh_token = generate_refresh_token_in_db(user.id, session_id=session.id)

    response = jsonify(
        {
            "message": "Login successful.",
            "token": access_token,
            "user": user.to_dict(viewer_id=user.id, include_email=True, include_settings=True),
        }
    )
    if refresh_token:
        response.set_cookie(
            "refresh_token",
            refresh_token,
            httponly=True,
            secure=True,
            samesite="None",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
    return response


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
    # Revoke all device sessions on password change to force re-authentication
    DeviceSession.query.filter_by(user_id=g.current_user.id).delete()
    db.session.commit()
    return jsonify({"message": "Password changed successfully. All sessions revoked. Please log in again."})


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

import random
from datetime import datetime, timedelta
from models.otp_verification import OtpVerification

@auth_bp.post("/check-identity")
@limiter.limit("10 per minute")
def check_identity():
    payload = _get_payload()
    identifier = (payload.get("identifier") or "").strip().lower()
    action = (payload.get("action") or "signup").strip().lower() # signup or login

    if not identifier:
        return jsonify({"message": "Identifier is required."}), 400
    
    # For signup:
    # 1. We ONLY want to block if the username is already taken.
    # 2. Email and phone number are allowed to be reused across multiple accounts.
    if action == "signup":
        user_by_username = User.query.filter(func.lower(User.username) == identifier).first()
        if user_by_username:
            return jsonify({"message": "An account with this username already exists."}), 409
        
        # If it's an email or phone, we allow it (exists = False for signup check so signup proceeds)
        return jsonify({
            "message": "Identity check passed.",
            "exists": False
        })

    # For login:
    # We still need to find the user by username, email, or phone number to let them log in.
    user = User.query.filter(
        or_(
            func.lower(User.email) == identifier,
            func.lower(User.username) == identifier,
            User.phone_number == identifier
        )
    ).first()

    if action == "login" and not user:
        return jsonify({"message": "No account found with this identifier."}), 404

    return jsonify({
        "message": "Identity check passed.",
        "exists": True
    })

@auth_bp.post("/send-otp")
@limiter.limit("5 per minute")
def send_otp():
    payload = _get_payload()
    identifier = (payload.get("identifier") or "").strip().lower()
    purpose = (payload.get("purpose") or "signup").strip().lower()

    if not identifier:
        return jsonify({"message": "Identifier is required."}), 400

    client_ip = get_client_ip()
    device_info = {
        "ip": client_ip,
        "device": parse_device_name(request.headers.get("User-Agent", "")),
        "location": get_device_location(client_ip)
    }

    res = generate_and_dispatch_otp(identifier, purpose, device_info)
    status_code = res.get("status_code", 200)
    
    res_copy = dict(res)
    res_copy.pop("status_code", None)
    
    return jsonify(res_copy), status_code

@auth_bp.post("/verify-otp")
@limiter.limit("10 per minute")
def verify_otp():
    payload = _get_payload()
    identifier = (payload.get("identifier") or "").strip().lower()
    otp = (payload.get("otp") or "").strip()
    purpose = (payload.get("purpose") or "signup").strip().lower()

    if not identifier or not otp:
        return jsonify({"message": "Identifier and OTP are required."}), 400

    verification = OtpVerification.query.filter_by(
        identifier=identifier, purpose=purpose, is_verified=False
    ).order_by(OtpVerification.created_at.desc()).first()

    if not verification:
        return jsonify({"message": "No pending verification code found."}), 404

    if verification.expires_at < datetime.utcnow():
        return jsonify({"message": "Verification code has expired."}), 400

    if verification.attempts >= 5:
        return jsonify({"message": "Verification code locked due to too many failed attempts. Please request a new code."}), 429

    # Compare hashed OTP
    if verification.otp != hash_otp(otp):
        verification.attempts += 1
        db.session.commit()
        remaining = 5 - verification.attempts
        return jsonify({"message": f"Invalid verification code. {remaining} attempts remaining." if remaining > 0 else "Code locked due to too many failed attempts."}), 400

    verification.is_verified = True
    db.session.commit()

    return jsonify({
        "message": "OTP verified successfully.",
        "verification_id": verification.id
    })


@auth_bp.get("/sessions")
@token_required
def get_sessions():
    sessions = DeviceSession.query.filter_by(user_id=g.current_user.id).order_by(DeviceSession.last_active.desc()).all()
    current_session_id = getattr(g, "current_session_id", None)
    return jsonify([
        {
            **session.to_dict(),
            "is_current": session.id == current_session_id
        }
        for session in sessions
    ])


@auth_bp.post("/sessions/logout-others")
@token_required
def logout_others():
    current_session_id = getattr(g, "current_session_id", None)
    if current_session_id:
        DeviceSession.query.filter(
            DeviceSession.user_id == g.current_user.id,
            DeviceSession.id != current_session_id
        ).delete()
    else:
        DeviceSession.query.filter_by(user_id=g.current_user.id).delete()
        client_ip = get_client_ip()
        user_agent = request.headers.get("User-Agent", "")
        new_sess = DeviceSession(
            user_id=g.current_user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            device_name=parse_device_name(user_agent),
            location=get_device_location(client_ip)
        )
        db.session.add(new_sess)
    db.session.commit()
    return jsonify({"message": "Successfully logged out from all other devices."})


@auth_bp.delete("/sessions/<session_id>")
@token_required
def delete_session(session_id):
    session = DeviceSession.query.filter_by(user_id=g.current_user.id, id=session_id).first()
    if not session:
        return jsonify({"message": "Session not found."}), 404
        
    current_session_id = getattr(g, "current_session_id", None)
    db.session.delete(session)
    db.session.commit()
    
    is_self = (session_id == current_session_id)
    return jsonify({
        "message": "Successfully terminated session.",
        "is_self": is_self
    })


@auth_bp.post("/link-identifier")
@token_required
def link_identifier():
    payload = _get_payload()
    identifier_type = payload.get("type") # "email" or "phone"
    value = (payload.get("value") or "").strip()
    
    if not identifier_type or not value:
        return jsonify({"message": "Identifier type and value are required."}), 400
        
    if identifier_type == "email":
        value = value.lower()
        if not EMAIL_REGEX.match(value):
            return jsonify({"message": "Invalid email address."}), 400
            
        existing = User.query.filter(func.lower(User.email) == value).first()
        if existing:
            return jsonify({"message": "Email is already linked to another account."}), 409
            
        g.current_user.email = value
    elif identifier_type == "phone":
        existing = User.query.filter(User.phone_number == value).first()
        if existing:
            return jsonify({"message": "Phone number is already linked to another account."}), 409
            
        g.current_user.phone_number = value
    else:
        return jsonify({"message": "Invalid identifier type."}), 400
        
    db.session.commit()
    return jsonify({
        "message": f"Successfully linked {identifier_type}.",
        "user": g.current_user.to_dict(viewer_id=g.current_user.id, include_email=True, include_settings=True)
    })


@auth_bp.post("/unlink-identifier")
@token_required
def unlink_identifier():
    payload = _get_payload()
    identifier_type = payload.get("type") # "email" or "phone"
    
    if not identifier_type:
        return jsonify({"message": "Identifier type is required."}), 400
        
    if identifier_type == "email":
        if not g.current_user.phone_number:
            return jsonify({"message": "Cannot unlink email. You must have a phone number linked to preserve access."}), 400
        g.current_user.email = None
    elif identifier_type == "phone":
        if not g.current_user.email:
            return jsonify({"message": "Cannot unlink phone number. You must have an email linked to preserve access."}), 400
        g.current_user.phone_number = None
    else:
        return jsonify({"message": "Invalid identifier type."}), 400
        
    db.session.commit()
    return jsonify({
        "message": f"Successfully unlinked {identifier_type}.",
        "user": g.current_user.to_dict(viewer_id=g.current_user.id, include_email=True, include_settings=True)
    })


@auth_bp.post("/refresh")
def refresh_token():
    old_token = request.cookies.get("refresh_token")
    if not old_token:
        return jsonify({"message": "Refresh token missing."}), 401

    from utils.jwt_helper import rotate_refresh_token
    new_access_token, new_refresh_token = rotate_refresh_token(old_token)

    if not new_access_token:
        return jsonify({"message": "Invalid or expired session. Please log in again."}), 401

    response = jsonify({
        "token": new_access_token,
        "message": "Token refreshed successfully."
    })

    response.set_cookie(
        "refresh_token",
        new_refresh_token,
        httponly=True,
        secure=True,
        samesite="None",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    return response


@auth_bp.post("/logout")
def logout():
    old_token = request.cookies.get("refresh_token")
    if old_token:
        from models.device_session import DeviceSession
        session = DeviceSession.query.filter_by(refresh_token=old_token).first()
        if session:
            db.session.delete(session)
            db.session.commit()

    response = jsonify({"message": "Logged out successfully."})
    response.delete_cookie("refresh_token", httponly=True, secure=True, samesite="None")
    return response
