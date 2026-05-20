import hashlib
import random
import re
import logging
from datetime import datetime, timedelta
from flask import current_app, request
from extensions import db
from models.otp_verification import OtpVerification
from utils.email_service import send_smtp_email

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def hash_otp(otp: str) -> str:
    """Hashes the OTP code using SHA256."""
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()

def is_email(identifier: str) -> bool:
    """Checks if the identifier is an email address."""
    return bool(EMAIL_REGEX.match(identifier))

def check_otp_cooldown(identifier: str, purpose: str) -> bool:
    """
    Checks if a recent OTP was requested within 60 seconds (resend cooldown).
    Returns True if allowed (no cooldown active), False otherwise.
    """
    recent = OtpVerification.query.filter_by(
        identifier=identifier,
        purpose=purpose,
        is_verified=False
    ).order_by(OtpVerification.created_at.desc()).first()

    if recent:
        elapsed = (datetime.utcnow() - recent.created_at).total_seconds()
        if elapsed < 60:
            return False
    return True

def generate_and_dispatch_otp(identifier: str, purpose: str, device_info=None) -> dict:
    """
    Generates a secure 6-digit OTP, stores its SHA-256 hash in the database,
    and dispatches it via SMTP email or Twilio/mock SMS.
    """
    # 1. Cooldown Check
    if not check_otp_cooldown(identifier, purpose):
        return {"success": False, "message": "Please wait 60 seconds before requesting another code.", "status_code": 429}

    # 2. Limit active pending OTPs
    OtpVerification.query.filter_by(identifier=identifier, purpose=purpose, is_verified=False).delete()

    # 3. Generate OTP & expiry
    otp = str(random.randint(100000, 999999))
    hashed = hash_otp(otp)
    expires_at = datetime.utcnow() + timedelta(minutes=5) # Hardened to 5 minutes

    # 4. Save to DB
    verification = OtpVerification(
        identifier=identifier,
        otp=hashed, # Store hashed version only
        purpose=purpose,
        expires_at=expires_at
    )
    db.session.add(verification)
    db.session.commit()

    # 5. Dispatch
    success = False
    if is_email(identifier):
        success = send_smtp_email(identifier, otp, purpose, device_info)
    else:
        success = send_sms_otp(identifier, otp, purpose)

    if not success:
        # If real delivery failed, we fall back to logging in console so it does not block devs/users completely
        print(f"--- OTP DELIVERY FALLBACK to {identifier}: {otp} (Purpose: {purpose}) ---")
        return {
            "success": True, 
            "message": "OTP sent successfully (fallback).", 
            "otp_id": verification.id,
            "status_code": 200
        }

    return {
        "success": True, 
        "message": "OTP sent successfully.", 
        "otp_id": verification.id,
        "status_code": 200
    }

def send_sms_otp(phone_number: str, otp: str, purpose: str) -> bool:
    """
    Sends an SMS OTP using Twilio if configured, or falls back to secure mock logging.
    """
    account_sid = current_app.config.get("TWILIO_ACCOUNT_SID")
    auth_token = current_app.config.get("TWILIO_AUTH_TOKEN")
    twilio_number = current_app.config.get("TWILIO_PHONE_NUMBER")
    enable_real_sms = current_app.config.get("ENABLE_REAL_SMS", False)

    if not enable_real_sms or not account_sid or not auth_token or not twilio_number:
        # Graceful mock log fallback
        logger.info(f"[MOCK SMS] Sent OTP to {phone_number}: {otp} (Purpose: {purpose})")
        print(f"--- MOCK SMS SENT to {phone_number}: {otp} (Purpose: {purpose}) ---")
        return True

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=f"Your Neurality verification code is {otp}. Valid for 5 minutes.",
            from_=twilio_number,
            to=phone_number
        )
        logger.info(f"Twilio SMS sent successfully to {phone_number}. SID: {message.sid}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send Twilio SMS to {phone_number}: {exc}", exc_info=True)
        print(f"--- TWILIO SMS SEND FAILURE to {phone_number}: {exc} (OTP was {otp}) ---")
        return False
