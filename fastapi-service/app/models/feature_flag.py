from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feature_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rollout_percentage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    config_json: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow, 
        nullable=False
    )

    rules: Mapped[list["FeatureFlagRule"]] = relationship(
        "FeatureFlagRule", back_populates="feature_flag", cascade="all, delete-orphan", lazy="selectin"
    )

class FeatureFlagRule(Base):
    __tablename__ = "feature_flag_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feature_flag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("feature_flags.id", ondelete="CASCADE"), nullable=False
    )
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "region", "beta_cohort", "user_id"
    rule_value: Mapped[str] = mapped_column(String(255), nullable=False)

    feature_flag: Mapped["FeatureFlag"] = relationship("FeatureFlag", back_populates="rules")

    __table_args__ = (
        Index("idx_rules_feature_flag_id", "feature_flag_id"),
    )

class ExperimentAssignment(Base):
    __tablename__ = "experiment_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    feature_name: Mapped[str] = mapped_column(String(100), nullable=False)
    variant: Mapped[str] = mapped_column(String(50), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "feature_name", name="uq_user_feature_assignment"),
        Index("idx_assignments_user_feature", "user_id", "feature_name"),
    )
