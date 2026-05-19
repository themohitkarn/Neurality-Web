from datetime import datetime
from pydantic import BaseModel, Field
from typing import Dict, Any

class NotificationResponse(BaseModel):
    id: int
    user_id: str
    actor_id: str | None = None
    type: str
    title: str
    body: str
    payload_json: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationPreferenceResponse(BaseModel):
    push_enabled: bool
    websocket_enabled: bool
    email_enabled: bool
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None

    class Config:
        from_attributes = True

class NotificationPreferenceUpdate(BaseModel):
    push_enabled: bool | None = None
    websocket_enabled: bool | None = None
    email_enabled: bool | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None

class TriggerNotificationRequest(BaseModel):
    user_id: str
    type: str
    title: str
    body: str
    actor_id: str | None = None
    payload_json: Dict[str, Any] | None = None
