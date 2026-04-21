"""Versus match endpoints: create, accept, decline, list, detail."""

from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession
from app.schemas.ranking import RankingUserInfo
from app.schemas.versus import (
    VersusActionRequest,
    VersusCreateRequest,
    VersusMatchDetailResponse,
    VersusMatchListResponse,
    VersusMatchResponse,
)
from app.services.versus_service import VersusService

router = APIRouter(prefix="/versus", tags=["versus"])


@router.post("", response_model=VersusMatchResponse, status_code=201)
@inject
async def create_match(
    body: VersusCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
    versus_service: VersusService = Depends(Provide[Container.versus_service]),
) -> VersusMatchResponse:
    """Challenge another user to a 1:1 versus match."""
    result = await versus_service.create_match(
        db=db,
        challenger_id=current_user.id,
        opponent_id=UUID(body.opponent_id),
        metric=body.metric,
        duration_days=body.duration_days,
    )
    return _to_response(result)


@router.post("/{match_id}/accept", response_model=VersusMatchResponse)
@inject
async def accept_match(
    match_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    versus_service: VersusService = Depends(Provide[Container.versus_service]),
) -> VersusMatchResponse:
    """Accept a pending versus match."""
    result = await versus_service.accept_match(
        db=db, match_id=match_id, user_id=current_user.id
    )
    return _to_response(result)


@router.post("/{match_id}/decline", response_model=VersusMatchResponse)
@inject
async def decline_match(
    match_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    versus_service: VersusService = Depends(Provide[Container.versus_service]),
) -> VersusMatchResponse:
    """Decline or cancel a pending versus match."""
    result = await versus_service.decline_match(
        db=db, match_id=match_id, user_id=current_user.id
    )
    return _to_response(result)


@router.get("", response_model=VersusMatchListResponse)
@inject
async def list_active_matches(
    current_user: CurrentUser,
    db: DbSession,
    versus_service: VersusService = Depends(Provide[Container.versus_service]),
) -> VersusMatchListResponse:
    """Get all active and pending matches for the current user."""
    matches, total = await versus_service.get_active_matches(
        db=db, user_id=current_user.id
    )
    return VersusMatchListResponse(
        data=[_to_response(m) for m in matches],
        total=total,
    )


@router.get("/history", response_model=VersusMatchListResponse)
@inject
async def list_match_history(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    versus_service: VersusService = Depends(Provide[Container.versus_service]),
) -> VersusMatchListResponse:
    """Get completed/declined/cancelled match history."""
    matches, total = await versus_service.get_match_history(
        db=db,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
    )
    return VersusMatchListResponse(
        data=[_to_response(m) for m in matches],
        total=total,
    )


@router.get("/{match_id}", response_model=VersusMatchDetailResponse)
@inject
async def get_match_detail(
    match_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    versus_service: VersusService = Depends(Provide[Container.versus_service]),
) -> VersusMatchDetailResponse:
    """Get detail of a versus match."""
    result = await versus_service.get_match_detail(db=db, match_id=match_id)
    return VersusMatchDetailResponse(**result)


def _to_response(data: dict) -> VersusMatchResponse:
    """Convert service dict to response model."""
    return VersusMatchResponse(
        id=data["id"],
        challenger=RankingUserInfo(**data["challenger"]),
        opponent=RankingUserInfo(**data["opponent"]),
        status=data["status"],
        metric=data["metric"],
        duration_days=data["duration_days"],
        start_date=data["start_date"],
        end_date=data["end_date"],
        challenger_value=data["challenger_value"],
        opponent_value=data["opponent_value"],
        winner_id=data["winner_id"],
        created_at=data["created_at"],
    )
