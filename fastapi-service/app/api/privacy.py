import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.core.auth_deps import get_current_user
from app.models.user import User
from app.core.privacy_service import PrivacyService, VALID_EDGE_TYPES

logger = logging.getLogger("fastapi-app")

router = APIRouter(prefix="/graph", tags=["privacy-graph"])

class GraphEdgeRequest(BaseModel):
    target_user_id: str = Field(..., description="Target user identifier")
    edge_type: str = Field(..., description="Type of relationship edge: blocked, muted, restricted, close_friend, favorite")

class RelationshipResponse(BaseModel):
    is_blocked: bool
    is_blocked_by: bool
    is_muted: bool
    is_restricted: bool
    is_close_friend: bool
    is_favorite: bool

@router.post("/edge", status_code=status.HTTP_201_CREATED)
async def create_edge(
    payload: GraphEdgeRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new social relationship edge (e.g., block, mute, favorite) to another user."""
    source_id = str(current_user.id)
    target_id = payload.target_user_id.strip()
    edge_type = payload.edge_type.strip().lower()

    if edge_type not in VALID_EDGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid edge_type. Valid values: {list(VALID_EDGE_TYPES)}"
        )

    if source_id == target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot establish a relationship edge with yourself."
        )

    try:
        edge = await PrivacyService.add_edge(source_id, target_id, edge_type)
        return {
            "status": "success",
            "message": f"Relationship edge '{edge_type}' successfully created.",
            "edge": {
                "source_user_id": edge.source_user_id,
                "target_user_id": edge.target_user_id,
                "edge_type": edge.edge_type,
                "created_at": edge.created_at.isoformat()
            }
        }
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as e:
        logger.error(f"Failed to create edge for source {source_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to establish edge")

@router.delete("/edge")
async def delete_edge(
    payload: GraphEdgeRequest,
    current_user: User = Depends(get_current_user)
):
    """Delete an existing social relationship edge (e.g. unblock, unmute, unfavorite) to another user."""
    source_id = str(current_user.id)
    target_id = payload.target_user_id.strip()
    edge_type = payload.edge_type.strip().lower()

    if edge_type not in VALID_EDGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid edge_type. Valid values: {list(VALID_EDGE_TYPES)}"
        )

    try:
        removed = await PrivacyService.remove_edge(source_id, target_id, edge_type)
        if not removed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Relationship edge '{edge_type}' to target user '{target_id}' not found."
            )
        return {
            "status": "success",
            "message": f"Relationship edge '{edge_type}' successfully removed."
        }
    except Exception as e:
        logger.error(f"Failed to remove edge for source {source_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to remove edge")

@router.get("/edges/{edge_type}")
async def get_edges(
    edge_type: str,
    current_user: User = Depends(get_current_user)
):
    """Retrieve all target user IDs matching a specific edge type for the current user."""
    source_id = str(current_user.id)
    edge_type_clean = edge_type.strip().lower()

    if edge_type_clean not in VALID_EDGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid edge_type. Valid values: {list(VALID_EDGE_TYPES)}"
        )

    try:
        targets = await PrivacyService.get_edges(source_id, edge_type_clean)
        return targets
    except Exception as e:
        logger.error(f"Failed to list edges for user {source_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve edges")

@router.get("/relationship/{target_user_id}", response_model=RelationshipResponse)
async def get_relationship_status(
    target_user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get the full composite relationship snapshot (is_blocked, is_muted, etc.) between the current user and target user."""
    source_id = str(current_user.id)
    target_id = target_user_id.strip()

    try:
        relationship = await PrivacyService.get_relationship(source_id, target_id)
        return relationship
    except Exception as e:
        logger.error(f"Failed to load relationship for user {source_id} -> {target_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load relationship status")
