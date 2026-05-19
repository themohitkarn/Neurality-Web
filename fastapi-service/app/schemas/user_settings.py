from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class UserSettingsBase(BaseModel):
    theme: Optional[str] = Field(default="dark", description="UI color theme (e.g. light, dark)")
    email_notifications: Optional[bool] = Field(default=True, description="Enable email alerts")
    push_notifications: Optional[bool] = Field(default=True, description="Enable mobile push alerts")
    language: Optional[str] = Field(default="en", description="Preferred localization language code")

class UserSettingsUpdate(UserSettingsBase):
    user_id: str = Field(..., description="Unique user identifier associated with settings")
    expected_version: int = Field(..., description="The expected version number of settings in client memory for conflict detection")

class UserSettingsResponse(UserSettingsBase):
    user_id: str
    version: int
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
