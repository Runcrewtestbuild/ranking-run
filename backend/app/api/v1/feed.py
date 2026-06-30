"""Feed endpoints: activity feed, user activities, reactions, and comments."""

import logging
from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func, select

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession
from app.models.feed_comment import FeedComment
from app.schemas.feed import (
    ActivityFeedPaginatedResponse,
    ActivityResponse,
    AddReactionRequest,
    CreateActivityRequest,
    CreateFeedCommentRequest,
    FeedCommentPaginatedResponse,
    FeedCommentResponse,
    FeedUserInfo,
    ReactionResponse,
    ReactionsAggregateResponse,
    RunSummary,
    WeeklyHighlightsResponse,
    VALID_REACTION_TYPES,
)
from app.services.feed_service import FeedService
from app.services.feed_comment_service import FeedCommentService
from app.services.notification_service import NotificationService
from app.services.reaction_service import ReactionService

logger = logging.getLogger(__name__)

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


async def _get_comment_counts_batch(
    db,
    activity_ids: list[UUID],
) -> dict[UUID, int]:
    """Batch-fetch comment counts for a list of activity IDs."""
    if not activity_ids:
        return {}
    result = await db.execute(
        select(
            FeedComment.activity_id,
            sa_func.count().label("cnt"),
        )
        .where(FeedComment.activity_id.in_(activity_ids))
        .group_by(FeedComment.activity_id)
    )
    return {row.activity_id: row.cnt for row in result.all()}


def _simplify_route(coordinates: list[list[float]], max_points: int = 60) -> list[list[float]]:
    """Downsample route coordinates for preview display."""
    if len(coordinates) <= max_points:
        return coordinates
    step = len(coordinates) / max_points
    return [coordinates[int(i * step)] for i in range(max_points)]


def _build_run_summary(run_record) -> RunSummary | None:
    if run_record is None:
        return None
    course_title = None
    if run_record.course is not None:
        course_title = run_record.course.title

    # Extract route preview from stored PostGIS geometry
    route_preview = None
    if run_record.route_geometry is not None:
        try:
            from geoalchemy2.shape import to_shape
            shape = to_shape(run_record.route_geometry)
            coords = list(shape.coords)  # [(lng, lat, ...), ...]
            if len(coords) >= 2:
                # Convert to [[lng, lat], ...]
                simple_coords = [[c[0], c[1]] for c in coords]
                route_preview = _simplify_route(simple_coords)
        except Exception:
            pass

    return RunSummary(
        id=str(run_record.id),
        distance_meters=run_record.distance_meters,
        duration_seconds=run_record.duration_seconds,
        avg_pace_seconds_per_km=run_record.avg_pace_seconds_per_km,
        course_title=course_title,
        route_thumbnail_url=run_record.route_thumbnail_url,
        route_thumbnail_url_light=run_record.route_thumbnail_url_light,
        route_preview=route_preview,
    )


def _build_activity_response(
    activity,
    reactions_data: dict | None = None,
    comment_count: int = 0,
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
        comment_count=comment_count,
        created_at=activity.created_at,
    )


# ---------------------------------------------------------------------------
# Feed Endpoints
# ---------------------------------------------------------------------------

@router.get("/trending", response_model=ActivityFeedPaginatedResponse)
@inject
async def get_trending_feed(
    current_user: CurrentUser,
    db: DbSession,
    hours: int = Query(48, ge=12, le=168),
    limit: int = Query(20, ge=1, le=50),
    feed_service: FeedService = Depends(Provide[Container.feed_service]),
) -> ActivityFeedPaginatedResponse:
    """Get trending activities ordered by reaction count in the last N hours."""
    activities = await feed_service.get_trending(
        db=db, hours=hours, limit=limit,
    )

    activity_ids = [a.id for a in activities]
    reactions_map = await feed_service.get_reactions_summary_batch(
        db=db,
        activity_ids=activity_ids,
        current_user_id=current_user.id,
    )
    comment_counts = await _get_comment_counts_batch(db, activity_ids)

    return ActivityFeedPaginatedResponse(
        data=[
            _build_activity_response(
                a, reactions_map.get(a.id), comment_counts.get(a.id, 0),
            )
            for a in activities
        ],
        total_count=len(activities),
        page=0,
        per_page=limit,
    )


@router.get("/highlights", response_model=WeeklyHighlightsResponse)
@inject
async def get_weekly_highlights(
    current_user: CurrentUser,
    db: DbSession,
    feed_service: FeedService = Depends(Provide[Container.feed_service]),
) -> WeeklyHighlightsResponse:
    """Get this week's community highlights for the Discover tab."""
    data = await feed_service.get_weekly_highlights(db=db)

    top_activity_response = None
    if data["top_activity"] is not None:
        activity = data["top_activity"]
        # Fetch reaction summary for the top activity
        reactions_map = await feed_service.get_reactions_summary_batch(
            db=db,
            activity_ids=[activity.id],
            current_user_id=current_user.id,
        )
        comment_counts = await _get_comment_counts_batch(db, [activity.id])
        top_activity_response = _build_activity_response(
            activity,
            reactions_map.get(activity.id),
            comment_counts.get(activity.id, 0),
        )

    return WeeklyHighlightsResponse(
        runner_count=data["runner_count"],
        pr_count=data["pr_count"],
        total_distance_meters=data["total_distance_meters"],
        top_activity=top_activity_response,
        week_start=data["week_start"],
    )


@router.get("", response_model=ActivityFeedPaginatedResponse)
@inject
async def get_feed(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=50),
    scope: str = Query("all"),
    feed_service: FeedService = Depends(Provide[Container.feed_service]),
) -> ActivityFeedPaginatedResponse:
    """Get paginated feed. scope=all (mixed) or scope=following (following only)."""
    activities, total_count = await feed_service.get_feed(
        db=db,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        scope=scope,
    )

    # Batch-fetch reaction summaries and comment counts
    activity_ids = [a.id for a in activities]
    reactions_map = await feed_service.get_reactions_summary_batch(
        db=db,
        activity_ids=activity_ids,
        current_user_id=current_user.id,
    )
    comment_counts = await _get_comment_counts_batch(db, activity_ids)

    return ActivityFeedPaginatedResponse(
        data=[
            _build_activity_response(
                a, reactions_map.get(a.id), comment_counts.get(a.id, 0),
            )
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
    comment_counts = await _get_comment_counts_batch(db, activity_ids)

    return ActivityFeedPaginatedResponse(
        data=[
            _build_activity_response(
                a, reactions_map.get(a.id), comment_counts.get(a.id, 0),
            )
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


# ---------------------------------------------------------------------------
# Comment Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/activities/{activity_id}/comments",
    response_model=FeedCommentPaginatedResponse,
)
@inject
async def get_comments(
    activity_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=50),
    feed_comment_service: FeedCommentService = Depends(
        Provide[Container.feed_comment_service]
    ),
) -> FeedCommentPaginatedResponse:
    """Get paginated comments for an activity."""
    comments, total_count = await feed_comment_service.get_comments(
        db=db, activity_id=activity_id, page=page, per_page=per_page,
    )
    return FeedCommentPaginatedResponse(
        data=[FeedCommentResponse(**c) for c in comments],
        total_count=total_count,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/activities/{activity_id}/comments",
    response_model=FeedCommentResponse,
    status_code=201,
)
@inject
async def create_comment(
    activity_id: UUID,
    body: CreateFeedCommentRequest,
    current_user: CurrentUser,
    db: DbSession,
    feed_comment_service: FeedCommentService = Depends(
        Provide[Container.feed_comment_service]
    ),
    notification_service: NotificationService = Depends(
        Provide[Container.notification_service]
    ),
) -> FeedCommentResponse:
    """Create a top-level comment on an activity."""
    comment = await feed_comment_service.create_comment(
        db=db,
        activity_id=activity_id,
        user_id=current_user.id,
        content=body.content,
    )

    # Notify activity author (skip self-comment)
    activity_author_id = comment.get("activity_author_id")
    if activity_author_id and str(activity_author_id) != str(current_user.id):
        try:
            await notification_service.send_feed_comment_notification(
                db=db,
                activity_author_id=activity_author_id,
                actor_id=current_user.id,
                actor_nickname=current_user.nickname or "누군가",
                activity_id=str(activity_id),
            )
        except Exception:
            logger.error(
                "Failed to send feed_comment notification for activity %s",
                activity_id, exc_info=True,
            )

    return FeedCommentResponse(**{k: v for k, v in comment.items()
                                  if k not in ("activity_author_id", "parent_author_id")})


@router.post(
    "/activities/{activity_id}/comments/{parent_id}/replies",
    response_model=FeedCommentResponse,
    status_code=201,
)
@inject
async def create_reply(
    activity_id: UUID,
    parent_id: UUID,
    body: CreateFeedCommentRequest,
    current_user: CurrentUser,
    db: DbSession,
    feed_comment_service: FeedCommentService = Depends(
        Provide[Container.feed_comment_service]
    ),
    notification_service: NotificationService = Depends(
        Provide[Container.notification_service]
    ),
) -> FeedCommentResponse:
    """Create a reply to an existing comment."""
    comment = await feed_comment_service.create_comment(
        db=db,
        activity_id=activity_id,
        user_id=current_user.id,
        content=body.content,
        parent_id=parent_id,
    )

    # Notify parent comment author (skip self-reply)
    parent_author_id = comment.get("parent_author_id")
    if parent_author_id and str(parent_author_id) != str(current_user.id):
        try:
            await notification_service.send_feed_reply_notification(
                db=db,
                parent_comment_author_id=parent_author_id,
                actor_id=current_user.id,
                actor_nickname=current_user.nickname or "누군가",
                activity_id=str(activity_id),
            )
        except Exception:
            logger.error(
                "Failed to send feed_reply notification for activity %s",
                activity_id, exc_info=True,
            )

    # Also notify activity author if different from parent comment author
    activity_author_id = comment.get("activity_author_id")
    if (
        activity_author_id
        and str(activity_author_id) != str(current_user.id)
        and str(activity_author_id) != str(parent_author_id or "")
    ):
        try:
            await notification_service.send_feed_comment_notification(
                db=db,
                activity_author_id=activity_author_id,
                actor_id=current_user.id,
                actor_nickname=current_user.nickname or "누군가",
                activity_id=str(activity_id),
            )
        except Exception:
            logger.error(
                "Failed to send feed_comment notification for activity %s",
                activity_id, exc_info=True,
            )

    return FeedCommentResponse(**{k: v for k, v in comment.items()
                                  if k not in ("activity_author_id", "parent_author_id")})


@router.delete(
    "/activities/{activity_id}/comments/{comment_id}",
    status_code=204,
)
@inject
async def delete_comment(
    activity_id: UUID,
    comment_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    feed_comment_service: FeedCommentService = Depends(
        Provide[Container.feed_comment_service]
    ),
) -> None:
    """Delete a comment (author only)."""
    await feed_comment_service.delete_comment(
        db=db, comment_id=comment_id, user_id=current_user.id,
    )
