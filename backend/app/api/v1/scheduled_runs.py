"""Scheduled run endpoints: crew group run scheduling and RSVP."""

from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession
from app.schemas.scheduled_run import (
    CrewDetailStats,
    CrewWeeklyRankingEntry,
    CrewWeeklyRankingListResponse,
    RSVPRequest,
    ScheduledRunCreateRequest,
    ScheduledRunListResponse,
    ScheduledRunParticipantInfo,
    ScheduledRunResponse,
    ScheduledRunUpdateRequest,
)
from app.services.crew_ranking_service import CrewRankingService
from app.services.scheduled_run_service import ScheduledRunService

router = APIRouter(tags=["scheduled-runs"])


# ------------------------------------------------------------------
# Scheduled Run CRUD (nested under crew)
# ------------------------------------------------------------------


@router.post(
    "/crews/{crew_id}/scheduled-runs",
    response_model=ScheduledRunResponse,
    status_code=201,
)
@inject
async def create_scheduled_run(
    crew_id: UUID,
    body: ScheduledRunCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> ScheduledRunResponse:
    result = await service.create_scheduled_run(
        db=db,
        crew_id=crew_id,
        organizer_id=current_user.id,
        data=body.model_dump(),
    )
    return ScheduledRunResponse(**result)


@router.patch(
    "/scheduled-runs/{scheduled_run_id}",
    response_model=ScheduledRunResponse,
)
@inject
async def update_scheduled_run(
    scheduled_run_id: UUID,
    body: ScheduledRunUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> ScheduledRunResponse:
    result = await service.update_scheduled_run(
        db=db,
        scheduled_run_id=scheduled_run_id,
        user_id=current_user.id,
        data=body.model_dump(exclude_unset=True),
    )
    return ScheduledRunResponse(**result)


@router.get(
    "/scheduled-runs/{scheduled_run_id}",
    response_model=ScheduledRunResponse,
)
@inject
async def get_scheduled_run(
    scheduled_run_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> ScheduledRunResponse:
    result = await service.get_scheduled_run(
        db=db,
        scheduled_run_id=scheduled_run_id,
        user_id=current_user.id,
    )
    return ScheduledRunResponse(**result)


@router.post(
    "/scheduled-runs/{scheduled_run_id}/cancel",
    status_code=204,
)
@inject
async def cancel_scheduled_run(
    scheduled_run_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> None:
    await service.cancel_run(
        db=db,
        scheduled_run_id=scheduled_run_id,
        user_id=current_user.id,
    )


# ------------------------------------------------------------------
# RSVP
# ------------------------------------------------------------------


@router.post(
    "/scheduled-runs/{scheduled_run_id}/rsvp",
    response_model=ScheduledRunResponse,
)
@inject
async def update_rsvp(
    scheduled_run_id: UUID,
    body: RSVPRequest,
    current_user: CurrentUser,
    db: DbSession,
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> ScheduledRunResponse:
    result = await service.update_rsvp(
        db=db,
        scheduled_run_id=scheduled_run_id,
        user_id=current_user.id,
        status=body.status,
    )
    return ScheduledRunResponse(**result)


@router.get(
    "/scheduled-runs/{scheduled_run_id}/participants",
    response_model=list[ScheduledRunParticipantInfo],
)
@inject
async def get_participants(
    scheduled_run_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> list[ScheduledRunParticipantInfo]:
    participants = await service.get_run_participants(
        db=db, scheduled_run_id=scheduled_run_id
    )
    return [ScheduledRunParticipantInfo(**p) for p in participants]


# ------------------------------------------------------------------
# Listing
# ------------------------------------------------------------------


@router.get(
    "/crews/{crew_id}/scheduled-runs",
    response_model=ScheduledRunListResponse,
)
@inject
async def get_crew_scheduled_runs(
    crew_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> ScheduledRunListResponse:
    runs, total = await service.get_upcoming_runs_for_crew(
        db=db,
        crew_id=crew_id,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
    )
    return ScheduledRunListResponse(
        data=[ScheduledRunResponse(**r) for r in runs],
        total_count=total,
    )


@router.get(
    "/scheduled-runs/my",
    response_model=ScheduledRunListResponse,
)
@inject
async def get_my_scheduled_runs(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    service: ScheduledRunService = Depends(
        Provide[Container.scheduled_run_service]
    ),
) -> ScheduledRunListResponse:
    runs, total = await service.get_upcoming_runs_for_user(
        db=db,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
    )
    return ScheduledRunListResponse(
        data=[ScheduledRunResponse(**r) for r in runs],
        total_count=total,
    )


# ------------------------------------------------------------------
# Crew vs Crew weekly ranking
# ------------------------------------------------------------------


@router.get(
    "/crew-rankings/weekly",
    response_model=CrewWeeklyRankingListResponse,
)
@inject
async def get_crew_weekly_ranking(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    service: CrewRankingService = Depends(
        Provide[Container.crew_ranking_service]
    ),
) -> CrewWeeklyRankingListResponse:
    result = await service.get_crew_weekly_ranking(
        db=db,
        page=page,
        per_page=per_page,
        requesting_user_id=current_user.id,
    )
    return CrewWeeklyRankingListResponse(
        data=[CrewWeeklyRankingEntry(**e) for e in result["data"]],
        total_count=result["total_count"],
        my_crew=(
            CrewWeeklyRankingEntry(**result["my_crew"])
            if result["my_crew"]
            else None
        ),
    )


@router.get(
    "/crews/{crew_id}/stats",
    response_model=CrewDetailStats,
)
@inject
async def get_crew_detail_stats(
    crew_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: CrewRankingService = Depends(
        Provide[Container.crew_ranking_service]
    ),
) -> CrewDetailStats:
    result = await service.get_crew_detail_stats(db=db, crew_id=crew_id)
    return CrewDetailStats(**result)
