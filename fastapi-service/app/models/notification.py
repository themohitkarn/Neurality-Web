from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    delivery_attempts = relationship("NotificationDeliveryAttempt", back_populates="notification", cascade="all, delete-orphan")

class NotificationDeliveryAttempt(Base):
    __tablename__ = "notification_delivery_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_id: Mapped[int] = mapped_column(Integer, ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False)
    delivery_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "websocket", "push", "email"
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # "pending", "success", "failed", "dlq"
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    notification = relationship("Notification", back_populates="delivery_attempts")

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    websocket_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    quiet_hours_start: Mapped[str | None] = mapped_column(String(10), nullable=True)  # e.g. "22:00"
    quiet_hours_end: Mapped[str | None] = mapped_column(String(10), nullable=True)    # e.g. "08:00"
