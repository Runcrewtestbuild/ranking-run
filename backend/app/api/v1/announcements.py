"""Announcement endpoints: public listing and admin creation."""

from dependency_injector.wiring import inject, Provide
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from sqlalchemy import select

from app.core.container import Container
from app.core.deps import CurrentUser, DbSession
from app.services.notification_service import NotificationService
from app.schemas.announcement import (
    AnnouncementCreateRequest,
    AnnouncementListResponse,
    AnnouncementResponse,
)
from app.services.announcement_service import AnnouncementService

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=AnnouncementListResponse)
@inject
async def get_announcements(
    db: DbSession,
    limit: int = Query(10, ge=1, le=50),
    service: AnnouncementService = Depends(
        Provide[Container.announcement_service]
    ),
) -> AnnouncementListResponse:
    items = await service.get_active(db=db, limit=limit)
    return AnnouncementListResponse(
        data=[AnnouncementResponse(**a) for a in items]
    )


@router.post("", response_model=AnnouncementResponse, status_code=201)
@inject
async def create_announcement(
    body: AnnouncementCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    service: AnnouncementService = Depends(
        Provide[Container.announcement_service]
    ),
    notification_service: NotificationService = Depends(
        Provide[Container.notification_service]
    ),
) -> AnnouncementResponse:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await service.create(db=db, data=body.model_dump())

    # Broadcast announcement notification to all users (in background)
    announcement_title = body.title if hasattr(body, "title") else result.get("title", "")

    async def _send_announcement_notifications() -> None:
        try:
            from app.db.session import async_session_factory
            from app.models.user import User
            from app.core.config import get_settings

            async with async_session_factory() as bg_db:
                users_result = await bg_db.execute(select(User.id))
                user_ids = [row[0] for row in users_result.all()]

                svc = NotificationService(get_settings())
                for uid in user_ids:
                    if uid == current_user.id:
                        continue
                    try:
                        await svc.create_and_send(
                            db=bg_db,
                            user_id=uid,
                            notification_type="announcement",
                            actor_id=current_user.id,
                            title="공지사항",
                            body=str(announcement_title),
                            target_id=result.get("id"),
                            target_type="announcement",
                        )
                    except Exception:
                        pass  # Best-effort per user
                await bg_db.commit()
        except Exception:
            logger.warning("Failed to send announcement notifications")

    background_tasks.add_task(_send_announcement_notifications)

    return AnnouncementResponse(**result)
