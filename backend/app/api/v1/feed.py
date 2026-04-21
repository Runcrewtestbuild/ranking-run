"""Feed endpoints: activity feed, user activities, and reactions."""

from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession
from app.schemas.feed import (
    ActivityFeedPaginatedResponse,
    ActivityResponse,
    AddReactionRequest,
    CreateActivityRequest,
    FeedUserInfo,
    ReactionResponse,
    ReactionsAggregateResponse,
    RunSummary,
    VALID_REACTION_TYPES,
)
from app.services.feed_service import FeedService
from app.services.reaction_service import ReactionService

router = APIRouter(prefix="/feed", tags=["feed"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_user_info(user) -> FeedUserInfo:
    return FeedUserInfo(
        id=str(user.id),
        nickname=user.nickname,
        avatar_url=user.avatar_url,
    )


def _build_run_summary(run_record) -> RunSummary | None:
    if run_record is None:
        return None
    course_title = None
    if run_record.course is not None:
        course_title = run_record.course.title
    return RunSummary(
        id=str(run_record.id),
        distance_meters=run_record.distance_meters,
        duration_seconds=run_record.duration_seconds,
        avg_pace_seconds_per_km=run_record.avg_pace_seconds_per_km,
        course_title=course_title,
        route_thumbnail_url=run_record.route_thumbnail_url,
    )


def _build_activity_response(
    activity,
    reactions_data: dict | None = None,
) -> ActivityResponse:
    counts = {}
    user_reacted: list[str] = []
    if reactions_data:
        counts = reactions_data.get("counts", {})
        user_reacted = reactions_data.get("user_reacted", [])

    return ActivityResponse(
        id=str(activity.id),
        user=_build_user_info(activity.user),
        activity_type=activity.activity_type,
        content=activity.content,
        image_urls=activity.image_urls or [],
        metadata=activity.metadata_,
        run_summary=_build_run_summary(activity.run_record),
        reactions_summary=counts,
        user_reactions=user_reacted,
        created_at=activity.created_at,
    )


# ---------------------------------------------------------------------------
# Feed Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ActivityFeedPaginatedResponse)
@inject
async def get_feed(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=50),
    feed_service: FeedService = Depends(Provide[Container.feed_service]),
) -> ActivityFeedPaginatedResponse:
    """Get paginated feed from followed users and own activities."""
    activities, total_count = await feed_service.get_feed(
        db=db,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
    )

    # Batch-fetch reaction summaries
    activity_ids = [a.id for a in activities]
    reactions_map = await feed_service.get_reactions_summary_batch(
        db=db,
        activity_ids=activity_ids,
        current_user_id=current_user.id,
    )

    return ActivityFeedPaginatedResponse(
        data=[
            _build_activity_response(a, reactions_map.get(a.id))
            for a in activities
        ],
        total_count=total_count,
        page=page,
        per_page=per_page,
    )


@router.get("/user/{user_id}", response_model=ActivityFeedPaginatedResponse)
@inject
async def get_user_activities(
    user_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=50),
    feed_service: FeedService = Depends(Provide[Container.feed_service]),
) -> ActivityFeedPaginatedResponse:
    """Get paginated activities for a specific user."""
    activities, total_count = await feed_service.get_user_activities(
        db=db,
        user_id=user_id,
        page=page,
        per_page=per_page,
    )

    activity_ids = [a.id for a in activities]
    reactions_map = await feed_service.get_reactions_summary_batch(
        db=db,
        activity_ids=activity_ids,
        current_user_id=current_user.id,
    )

    return ActivityFeedPaginatedResponse(
        data=[
            _build_activity_response(a, reactions_map.get(a.id))
            for a in activities
        ],
        total_count=total_count,
        page=page,
        per_page=per_page,
    )


@router.post("/activities", response_model=ActivityResponse, status_code=201)
@inject
async def create_activity(
    body: CreateActivityRequest,
    current_user: CurrentUser,
    db: DbSession,
    feed_service: FeedService = Depends(Provide[Container.feed_service]),
) -> ActivityResponse:
    """Create a manual post activity."""
    activity = await feed_service.create_activity(
        db=db,
        user_id=current_user.id,
        activity_type="post",
        content=body.content,
        image_urls=body.image_urls,
    )
    return _build_activity_response(activity)


# ---------------------------------------------------------------------------
# Reaction Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/activities/{activity_id}/reactions",
    response_model=ReactionResponse,
    status_code=201,
)
@inject
async def add_reaction(
    activity_id: UUID,
    body: AddReactionRequest,
    current_user: CurrentUser,
    db: DbSession,
    reaction_service: ReactionService = Depends(Provide[Container.reaction_service]),
) -> ReactionResponse:
    """Add a reaction to an activity."""
    reaction = await reaction_service.add_reaction(
        db=db,
        user_id=current_user.id,
        activity_id=activity_id,
        reaction_type=body.reaction_type,
    )
    return ReactionResponse(
        id=str(reaction.id),
        user=_build_user_info(current_user),
        reaction_type=reaction.reaction_type,
        created_at=reaction.created_at,
    )


@router.delete(
    "/activities/{activity_id}/reactions/{reaction_type}",
    status_code=204,
)
@inject
async def remove_reaction(
    activity_id: UUID,
    reaction_type: str,
    current_user: CurrentUser,
    db: DbSession,
    reaction_service: ReactionService = Depends(Provide[Container.reaction_service]),
) -> None:
    """Remove a reaction from an activity."""
    await reaction_service.remove_reaction(
        db=db,
        user_id=current_user.id,
        activity_id=activity_id,
        reaction_type=reaction_type,
    )


@router.get(
    "/activities/{activity_id}/reactions",
    response_model=ReactionsAggregateResponse,
)
@inject
async def get_reactions(
    activity_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    reaction_service: ReactionService = Depends(Provide[Container.reaction_service]),
) -> ReactionsAggregateResponse:
    """Get aggregated reactions for an activity."""
    data = await reaction_service.get_reactions(
        db=db,
        activity_id=activity_id,
        current_user_id=current_user.id,
    )
    return ReactionsAggregateResponse(
        activity_id=str(activity_id),
        counts=data["counts"],
        user_reacted=data["user_reacted"],
    )
