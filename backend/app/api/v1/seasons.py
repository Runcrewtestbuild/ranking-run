"""Season endpoints: current season, user ranking, leaderboard."""

from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession, OptionalCurrentUser
from app.schemas.ranking import RankingUserInfo
from app.schemas.season import (
    SeasonLeaderboardResponse,
    SeasonRankingEntry,
    SeasonRankingResponse,
    SeasonResponse,
)
from app.services.season_service import SeasonService

router = APIRouter(prefix="/seasons", tags=["seasons"])


@router.get("/current", response_model=SeasonResponse | None)
@inject
async def get_current_season(
    db: DbSession,
    season_service: SeasonService = Depends(Provide[Container.season_service]),
) -> SeasonResponse | None:
    """Get the currently active season."""
    result = await season_service.get_current_season(db=db)
    if result is None:
        return None
    return SeasonResponse(**result)


@router.get("/{season_id}", response_model=SeasonResponse)
@inject
async def get_season(
    season_id: UUID,
    db: DbSession,
    season_service: SeasonService = Depends(Provide[Container.season_service]),
) -> SeasonResponse:
    """Get a season by ID."""
    result = await season_service.get_season_by_id(db=db, season_id=season_id)
    return SeasonResponse(**result)


@router.get("/{season_id}/my-rank", response_model=SeasonRankingResponse)
@inject
async def get_my_season_rank(
    season_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    season_service: SeasonService = Depends(Provide[Container.season_service]),
) -> SeasonRankingResponse:
    """Get current user's ranking for a specific season."""
    result = await season_service.get_user_season_rank(
        db=db, user_id=current_user.id, season_id=season_id
    )
    return SeasonRankingResponse(
        season=SeasonResponse(**result["season"]),
        tier=result["tier"],
        points=result["points"],
        rank=result["rank"],
        next_tier=result["next_tier"],
        points_to_next_tier=result["points_to_next_tier"],
    )


@router.post("/{season_id}/refresh-points", response_model=SeasonRankingResponse)
@inject
async def refresh_season_points(
    season_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    season_service: SeasonService = Depends(Provide[Container.season_service]),
) -> SeasonRankingResponse:
    """Recalculate season points for the current user."""
    await season_service.calculate_season_points(
        db=db, user_id=current_user.id
    )
    result = await season_service.get_user_season_rank(
        db=db, user_id=current_user.id, season_id=season_id
    )
    return SeasonRankingResponse(
        season=SeasonResponse(**result["season"]),
        tier=result["tier"],
        points=result["points"],
        rank=result["rank"],
        next_tier=result["next_tier"],
        points_to_next_tier=result["points_to_next_tier"],
    )


@router.get("/{season_id}/leaderboard", response_model=SeasonLeaderboardResponse)
@inject
async def get_season_leaderboard(
    season_id: UUID,
    db: DbSession,
    current_user: OptionalCurrentUser = None,
    tier: str | None = Query(None, pattern="^(bronze|silver|gold|platinum|diamond)$"),
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    season_service: SeasonService = Depends(Provide[Container.season_service]),
) -> SeasonLeaderboardResponse:
    """Get season leaderboard, optionally filtered by tier. Auth optional."""
    result = await season_service.get_season_leaderboard(
        db=db,
        season_id=season_id,
        tier=tier,
        page=page,
        per_page=per_page,
        requesting_user_id=current_user.id if current_user else None,
    )

    data = [
        SeasonRankingEntry(
            rank=e["rank"],
            user=RankingUserInfo(**e["user"]),
            tier=e["tier"],
            points=e["points"],
        )
        for e in result["data"]
    ]

    my_ranking = None
    if result["my_ranking"]:
        my_ranking = SeasonRankingEntry(
            rank=result["my_ranking"]["rank"],
            user=RankingUserInfo(**result["my_ranking"]["user"]),
            tier=result["my_ranking"]["tier"],
            points=result["my_ranking"]["points"],
        )

    return SeasonLeaderboardResponse(
        data=data,
        my_ranking=my_ranking,
        season=SeasonResponse(**result["season"]),
        total=result["total"],
    )
