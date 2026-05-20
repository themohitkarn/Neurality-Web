import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from flask import current_app

logger = logging.getLogger(__name__)

def send_smtp_email(to_email, otp, purpose="signup", device_info=None):
    """
    Sends a beautifully formatted dark-mode HTML verification email via Gmail SMTP.
    """
    smtp_host = current_app.config.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(current_app.config.get("SMTP_PORT", 587))
    smtp_user = current_app.config.get("SMTP_USER", "mohitkarn123@gmail.com")
    smtp_pass = current_app.config.get("SMTP_PASSWORD")
    smtp_sender = current_app.config.get("SMTP_SENDER", "mohitkarn123@gmail.com")
    enable_real_emails = current_app.config.get("ENABLE_REAL_EMAILS", True)

    if not enable_real_emails:
        logger.info(f"[MOCK EMAIL] Not sending real email to {to_email}. OTP is {otp}")
        return True

    if not smtp_pass:
        logger.error("SMTP_PASSWORD is not configured. Falling back to logging OTP.")
        print(f"--- SMTP CONFIG ERROR: OTP for {to_email} is {otp} (No SMTP password set) ---")
        return False

    # Purpose clean display
    purpose_title = "Verify Your Account"
    purpose_desc = "Thank you for joining Neurality. Use the verification code below to complete your registration."
    if purpose == "login" or purpose == "new_device_login":
        purpose_title = "New Device Authorization"
        purpose_desc = "A login attempt was made from a new device/IP. Please authorize this sign-in using the code below."
    elif purpose == "password_reset":
        purpose_title = "Reset Your Password"
        purpose_desc = "You requested a password reset. Use the code below to proceed."

    # Device Info Table
    device_details_html = ""
    if device_info:
        device_details_html = f"""
        <div style="background-color: #1a1a1a; padding: 12px; border-radius: 6px; margin-top: 15px; text-align: left; font-size: 13px; color: #aaaaaa;">
            <strong>Request Details:</strong><br/>
            • IP Address: {device_info.get('ip', 'Unknown')}<br/>
            • Device: {device_info.get('device', 'Unknown')}<br/>
            • Location: {device_info.get('location', 'Unknown')}
        </div>
        """

    # Premium dark-mode HTML
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{purpose_title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0b0c; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #121214; border: 1px solid #232329; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <!-- Header/Logo -->
            <tr>
                <td align="center" style="padding: 40px 20px 20px 20px; background: linear-gradient(135deg, #7f00ff, #e100ff);">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">NEURALITY</h1>
                    <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8; letter-spacing: 1px;">THE NEXT GENERATION REALTIME SOCIAL LAYER</p>
                </td>
            </tr>
            <!-- Content Body -->
            <tr>
                <td style="padding: 40px 30px; text-align: center;">
                    <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 700; color: #ffffff;">{purpose_title}</h2>
                    <p style="margin: 0 0 30px 0; font-size: 15px; line-height: 1.6; color: #b3b3b9;">{purpose_desc}</p>
                    
                    <!-- OTP Code Display -->
                    <div style="background: linear-gradient(145deg, #1b1b22, #16161b); border: 1px solid #32323f; display: inline-block; padding: 15px 40px; border-radius: 10px; margin-bottom: 30px;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #e100ff;">{otp}</span>
                    </div>

                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #88888e;">This verification code is valid for <strong>5 minutes</strong>.</p>
                    <p style="margin: 0 0 25px 0; font-size: 13px; color: #ff3b30; font-weight: 500;">For your security, NEVER share this code with anyone.</p>

                    {device_details_html}
                </td>
            </tr>
            <!-- Footer -->
            <tr>
                <td style="padding: 20px 30px; background-color: #0b0b0c; border-top: 1px solid #1c1c24; text-align: center; font-size: 12px; color: #66666e;">
                    <p style="margin: 0 0 8px 0;">If you did not request this email, please ignore it or secure your account.</p>
                    <p style="margin: 0;">&copy; 2026 Neurality. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{purpose_title}] Your Neurality Code"
        msg["From"] = smtp_sender
        msg["To"] = to_email

        # Attach text and HTML versions
        text_content = f"Your Neurality OTP code is: {otp}. Expiry: 5 minutes. Purpose: {purpose}."
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Setup Secure Connection
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_sender, to_email, msg.as_string())
        server.quit()

        logger.info(f"Successfully sent SMTP OTP email to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send SMTP email to {to_email}: {exc}", exc_info=True)
        # Never leak raw SMTP details to front-end, but log clearly for developers
        print(f"--- SMTP SEND FAILURE to {to_email}: {exc} (OTP was {otp}) ---")
        return False
