"""Crew feed endpoints: crew-scoped posts, pinning, activity summary."""

from uuid import UUID

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, Depends, Query

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession
from app.schemas.crew_feed import (
    CrewActivitySummary,
    CrewPostCreateRequest,
    CrewPostListResponse,
    CrewPostPinRequest,
    CrewPostResponse,
)
from app.services.crew_feed_service import CrewFeedService

router = APIRouter(prefix="/crews/{crew_id}/feed", tags=["crew-feed"])


# ------------------------------------------------------------------
# Feed
# ------------------------------------------------------------------


@router.get("", response_model=CrewPostListResponse)
@inject
async def get_crew_feed(
    crew_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    service: CrewFeedService = Depends(Provide[Container.crew_feed_service]),
) -> CrewPostListResponse:
    posts, total = await service.get_crew_feed(
        db=db,
        crew_id=crew_id,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
    )
    return CrewPostListResponse(
        data=[CrewPostResponse(**p) for p in posts],
        total_count=total,
    )


@router.post("", response_model=CrewPostResponse, status_code=201)
@inject
async def create_crew_post(
    crew_id: UUID,
    body: CrewPostCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
    service: CrewFeedService = Depends(Provide[Container.crew_feed_service]),
) -> CrewPostResponse:
    post = await service.create_crew_post(
        db=db,
        crew_id=crew_id,
        author_id=current_user.id,
        content=body.content,
        image_urls=body.image_urls,
        post_type=body.post_type,
        run_record_id=body.run_record_id,
    )
    return CrewPostResponse(**post)


@router.delete("/{post_id}", status_code=204)
@inject
async def delete_crew_post(
    crew_id: UUID,
    post_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: CrewFeedService = Depends(Provide[Container.crew_feed_service]),
) -> None:
    await service.delete_post(
        db=db, post_id=post_id, user_id=current_user.id
    )


@router.patch("/{post_id}/pin", response_model=CrewPostResponse)
@inject
async def pin_post(
    crew_id: UUID,
    post_id: UUID,
    body: CrewPostPinRequest,
    current_user: CurrentUser,
    db: DbSession,
    service: CrewFeedService = Depends(Provide[Container.crew_feed_service]),
) -> CrewPostResponse:
    post = await service.pin_post(
        db=db,
        post_id=post_id,
        user_id=current_user.id,
        is_pinned=body.is_pinned,
    )
    return CrewPostResponse(**post)


# ------------------------------------------------------------------
# Like
# ------------------------------------------------------------------


@router.post("/{post_id}/like", response_model=CrewPostResponse)
@inject
async def toggle_crew_post_like(
    crew_id: UUID,
    post_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: CrewFeedService = Depends(Provide[Container.crew_feed_service]),
) -> CrewPostResponse:
    post = await service.toggle_like(
        db=db,
        crew_id=crew_id,
        post_id=post_id,
        user_id=current_user.id,
    )
    return CrewPostResponse(**post)


# ------------------------------------------------------------------
# Activity summary
# ------------------------------------------------------------------


@router.get("/activity-summary", response_model=CrewActivitySummary)
@inject
async def get_crew_activity_summary(
    crew_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
    service: CrewFeedService = Depends(Provide[Container.crew_feed_service]),
) -> CrewActivitySummary:
    result = await service.get_crew_activity_summary(
        db=db, crew_id=crew_id, user_id=current_user.id
    )
    return CrewActivitySummary(**result)
