import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.auth_deps import get_current_user
from app.models.user import User
from app.core.db import AsyncSessionLocal
from sqlalchemy import select
from app.models.feature_flag import FeatureFlag
from app.schemas.feature_flag import (
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagKillSwitch,
    FeatureFlagResponse,
    FeatureFlagEvaluationResponse
)
from app.core.feature_flag_service import FeatureFlagService

logger = logging.getLogger("fastapi-app")

router = APIRouter(prefix="/features", tags=["feature-flags"])

@router.get("", response_model=List[FeatureFlagResponse])
async def list_features():
    """Retrieve all feature flags in the database, including targeting rules (for the admin dashboard)."""
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(FeatureFlag)
            res = await session.execute(stmt)
            flags = res.scalars().all()
            return flags
    except Exception as e:
        logger.error(f"Failed to list feature flags: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve feature flags"
        )

@router.post("/create", response_model=FeatureFlagResponse, status_code=status.HTTP_201_CREATED)
async def create_feature(
    payload: FeatureFlagCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new feature flag and propagate updates cluster-wide."""
    try:
        # Check if already exists
        async with AsyncSessionLocal() as session:
            stmt = select(FeatureFlag).where(FeatureFlag.feature_name == payload.feature_name)
            res = await session.execute(stmt)
            if res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Feature flag '{payload.feature_name}' already exists."
                )

        rules_list = [r.dict() for r in payload.rules] if payload.rules else None
        flag = await FeatureFlagService.create_flag(
            feature_name=payload.feature_name,
            enabled=payload.enabled,
            rollout_percentage=payload.rollout_percentage,
            config_json=payload.config_json,
            rules=rules_list
        )
        return flag
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create feature flag '{payload.feature_name}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create feature flag: {str(e)}"
        )

@router.post("/update", response_model=FeatureFlagResponse)
async def update_feature(
    payload: FeatureFlagUpdate,
    feature_name: str = Query(..., description="Feature name to update"),
    current_user: User = Depends(get_current_user)
):
    """Update feature flag targeting parameters or configs, and propagate updates cluster-wide."""
    try:
        rules_list = [r.dict() for r in payload.rules] if payload.rules is not None else None
        flag = await FeatureFlagService.update_flag(
            feature_name=feature_name,
            enabled=payload.enabled,
            rollout_percentage=payload.rollout_percentage,
            config_json=payload.config_json,
            rules=rules_list
        )
        return flag
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(val_err))
    except Exception as e:
        logger.error(f"Failed to update feature flag '{feature_name}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update feature flag: {str(e)}"
        )

@router.post("/kill-switch", response_model=FeatureFlagResponse)
async def toggle_kill_switch(
    payload: FeatureFlagKillSwitch,
    feature_name: str = Query(..., description="Feature name to toggle"),
    current_user: User = Depends(get_current_user)
):
    """Emergency disable or reactivate a feature flag instantly across the cluster."""
    try:
        flag = await FeatureFlagService.toggle_kill_switch(feature_name, payload.enabled)
        return flag
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(val_err))
    except Exception as e:
        logger.error(f"Failed to toggle kill switch for feature '{feature_name}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle kill switch"
        )

@router.get("/evaluate/{feature_name}", response_model=FeatureFlagEvaluationResponse)
async def evaluate_feature(
    feature_name: str,
    user_id: Optional[str] = Query(None, description="Optional target user ID (falls back to active session user if omitted)"),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Evaluate if a feature is active for the target user, parsing targeting segments, and allocating experiment variants."""
    target_user_id = user_id
    if not target_user_id:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required or target user_id query parameter must be supplied"
            )
        target_user_id = str(current_user.username)

    try:
        eval_result = await FeatureFlagService.evaluate_feature(target_user_id, feature_name)
        return eval_result
    except Exception as e:
        logger.error(f"Failed to evaluate feature '{feature_name}' for user '{target_user_id}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate feature flag"
        )
