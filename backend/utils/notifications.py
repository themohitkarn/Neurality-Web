import os
import firebase_admin
from firebase_admin import credentials, messaging
from flask import current_app

# Initialize Firebase Admin SDK
# The user needs to place their service account JSON file in the backend directory
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "..", "firebase-service-account.json")

def init_firebase():
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print("Firebase service account file not found. Push notifications will be disabled.")
        return False
    
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
        return True
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return False

def send_push_notification(token, title, body, data=None, image=None):
    if not token:
        return False
        
    if not init_firebase():
        return False

    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image
            ),
            data=data or {},
            token=token,
        )
        response = messaging.send(message)
        print(f"Successfully sent message: {response}")
        return True
    except Exception as e:
        print(f"Error sending push notification: {e}")
        return False

def notify_new_message(sender, receiver, message):
    if not receiver.push_notifications or not receiver.fcm_token:
        return
        
    title = f"New message from {sender.username}"
    body = message.content
    data = {
        "type": "new_message",
        "sender_id": str(sender.id),
        "message_id": str(message.id),
        "click_action": "FLUTTER_NOTIFICATION_CLICK" # For mobile app compatibility
    }
    
    send_push_notification(receiver.fcm_token, title, body, data, image=sender.profile_pic)

def notify_incoming_call(sender, receiver, call_type):
    if not receiver.push_notifications or not receiver.fcm_token:
        return
        
    title = f"Incoming {call_type} call"
    body = f"{sender.username} is calling you..."
    data = {
        "type": "incoming_call",
        "sender_id": str(sender.id),
        "call_type": call_type
    }
    
    send_push_notification(receiver.fcm_token, title, body, data, image=sender.profile_pic)
