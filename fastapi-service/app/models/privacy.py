from datetime import datetime
from sqlalchemy import String, DateTime, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class UserEdge(Base):
    __tablename__ = "user_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    target_user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    edge_type: Mapped[str] = mapped_column(String(50), nullable=False)  # blocked, muted, restricted, close_friend, favorite
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow, 
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("source_user_id", "target_user_id", "edge_type", name="uq_source_target_type"),
        Index("idx_source_type_target", "source_user_id", "edge_type", "target_user_id"),
        Index("idx_target_type_source", "target_user_id", "edge_type", "source_user_id"),
    )
