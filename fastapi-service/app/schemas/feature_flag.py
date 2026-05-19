from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RuleSchema(BaseModel):
    rule_type: str = Field(..., description="Type of targeting constraint (e.g. region, beta_cohort, user_id)")
    rule_value: str = Field(..., description="Constraint validation value")

    class Config:
        from_attributes = True

class FeatureFlagCreate(BaseModel):
    feature_name: str = Field(..., description="Unique name of the feature flag")
    enabled: bool = Field(default=False, description="Primary activation switch state")
    rollout_percentage: int = Field(default=0, ge=0, le=100, description="Deterministic percentage rollout rate (0-100)")
    config_json: Optional[str] = Field(default=None, description="Optional custom payload payload configuration string (JSON formatted)")
    rules: Optional[List[RuleSchema]] = Field(default=None, description="Set of targeting filters or whitelists")

class FeatureFlagUpdate(BaseModel):
    enabled: Optional[bool] = Field(default=None, description="Primary activation switch state")
    rollout_percentage: Optional[int] = Field(default=None, ge=0, le=100, description="Rollout percentage rate (0-100)")
    config_json: Optional[str] = Field(default=None, description="Optional custom payload payload configuration string (JSON formatted)")
    rules: Optional[List[RuleSchema]] = Field(default=None, description="Set of targeting filters or whitelists")

class FeatureFlagKillSwitch(BaseModel):
    enabled: bool = Field(..., description="Re-enable or execute immediate global shutdown of feature flag")

class FeatureFlagResponse(BaseModel):
    id: int
    feature_name: str
    enabled: bool
    rollout_percentage: int
    config_json: Optional[str]
    rules: List[RuleSchema]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class FeatureFlagEvaluationResponse(BaseModel):
    enabled: bool = Field(..., description="Is this feature flag enabled for the user")
    variant: str = Field(..., description="Sticky experiment variant allocated ('control' if none)")
    config: Dict[str, Any] = Field(..., description="Parsed configuration payload payload dict")
