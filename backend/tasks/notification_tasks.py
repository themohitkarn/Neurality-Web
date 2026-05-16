from extensions import celery

@celery.task(name="tasks.send_push_notification")
def send_push_notification(user_id, title, body):
    """
    Background task to send push notifications via FCM.
    """
    print(f"[Worker] Sending notification to User {user_id}: {title}")
    return True
