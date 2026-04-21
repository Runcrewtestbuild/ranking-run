"""Leaderboard endpoints: weekly top runners + multi-dimensional boards."""

from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession, OptionalCurrentUser
from app.schemas.leaderboard import (
    CourseRecordEntry,
    CourseRecordsResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    MyRankResponse,
    WeeklyLeaderboardResponse,
    WeeklyRunnerEntry,
)
from app.schemas.ranking import RankingUserInfo
from app.services.leaderboard_service import LeaderboardService
from app.services.stats_service import StatsService

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/weekly", response_model=WeeklyLeaderboardResponse)
@inject
async def get_weekly_leaderboard(
    db: DbSession,
    current_user: OptionalCurrentUser = None,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    region: str | None = Query(None),
    country: str | None = Query(None),
    stats_service: StatsService = Depends(Provide[Container.stats_service]),
) -> WeeklyLeaderboardResponse:
    """Get weekly leaderboard ranked by total distance. Auth optional."""
    result = await stats_service.get_weekly_leaderboard(
        db=db,
        page=page,
        per_page=per_page,
        region=region or None,
        country=country or None,
        requesting_user_id=current_user.id if current_user else None,
    )

    data = [
        WeeklyRunnerEntry(
            rank=entry["rank"],
            user=RankingUserInfo(**entry["user"]),
            total_distance_meters=entry["total_distance_meters"],
            run_count=entry["run_count"],
            total_duration_seconds=entry["total_duration_seconds"],
        )
        for entry in result["data"]
    ]

    my_ranking = None
    if result["my_ranking"]:
        my_ranking = WeeklyRunnerEntry(
            rank=result["my_ranking"]["rank"],
            user=RankingUserInfo(**result["my_ranking"]["user"]),
            total_distance_meters=result["my_ranking"]["total_distance_meters"],
            run_count=result["my_ranking"]["run_count"],
            total_duration_seconds=result["my_ranking"]["total_duration_seconds"],
        )

    return WeeklyLeaderboardResponse(
        data=data,
        my_ranking=my_ranking,
        period_start=result["period_start"],
        period_end=result["period_end"],
    )


# -- Multi-dimensional leaderboards --

@router.get("/weekly/{board_type}", response_model=LeaderboardResponse)
@inject
async def get_weekly_board(
    board_type: str,
    db: DbSession,
    current_user: OptionalCurrentUser = None,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    region: str | None = Query(None),
    country: str | None = Query(None),
    leaderboard_service: LeaderboardService = Depends(
        Provide[Container.leaderboard_service]
    ),
) -> LeaderboardResponse:
    """Get weekly leaderboard by dimension: distance, count, pace, elevation, streak."""
    method_map = {
        "distance": leaderboard_service.get_weekly_distance,
        "count": leaderboard_service.get_weekly_count,
        "pace": leaderboard_service.get_weekly_pace,
        "elevation": leaderboard_service.get_weekly_elevation,
        "streak": leaderboard_service.get_weekly_streak,
    }

    getter = method_map.get(board_type)
    if getter is None:
        return LeaderboardResponse(
            board_type=board_type, data=[], total=0,
        )

    result = await getter(
        db=db, page=page, per_page=per_page,
        region=region or None, country=country or None,
    )

    data = [
        LeaderboardEntry(
            rank=e["rank"],
            user=RankingUserInfo(**e["user"]),
            value=e["value"],
        )
        for e in result["data"]
    ]

    return LeaderboardResponse(
        board_type=result["board_type"],
        data=data,
        period_start=result.get("period_start"),
        period_end=result.get("period_end"),
        total=result["total"],
    )


@router.get("/courses/{course_id}/records", response_model=CourseRecordsResponse)
@inject
async def get_course_records(
    course_id: UUID,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    leaderboard_service: LeaderboardService = Depends(
        Provide[Container.leaderboard_service]
    ),
) -> CourseRecordsResponse:
    """Get course records (best completion times)."""
    result = await leaderboard_service.get_course_records(
        db=db, course_id=course_id, page=page, per_page=per_page,
    )
    data = [
        CourseRecordEntry(
            rank=e["rank"],
            user=RankingUserInfo(**e["user"]),
            duration_seconds=e["duration_seconds"],
            pace_seconds_per_km=e["pace_seconds_per_km"],
            achieved_at=e["achieved_at"],
        )
        for e in result["data"]
    ]
    return CourseRecordsResponse(
        course_id=result["course_id"],
        data=data,
        total=result["total"],
    )


@router.get("/my-rank/{board_type}", response_model=MyRankResponse)
@inject
async def get_my_rank(
    board_type: str,
    current_user: CurrentUser,
    db: DbSession,
    leaderboard_service: LeaderboardService = Depends(
        Provide[Container.leaderboard_service]
    ),
) -> MyRankResponse:
    """Get current user's rank on a specific board with gap to next."""
    result = await leaderboard_service.get_my_rank(
        db=db, user_id=current_user.id, board_type=board_type,
    )
    return MyRankResponse(**result)
