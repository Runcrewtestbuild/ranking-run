"""Scheduled run service: crew group run scheduling with RSVP."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models.crew import Crew, CrewMember
from app.models.scheduled_run import ScheduledRun, ScheduledRunParticipant


class ScheduledRunService:
    """Handles scheduled group run lifecycle and RSVP management."""

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create_scheduled_run(
        self,
        db: AsyncSession,
        crew_id: UUID,
        organizer_id: UUID,
        data: dict,
    ) -> dict:
        await self._assert_crew_member(db, crew_id, organizer_id)

        scheduled_run = ScheduledRun(
            crew_id=crew_id,
            organizer_id=organizer_id,
            title=data["title"],
            description=data.get("description"),
            scheduled_at=data["scheduled_at"],
            location_name=data.get("location_name"),
            location_lat=data.get("location_lat"),
            location_lng=data.get("location_lng"),
            estimated_distance_meters=data.get("estimated_distance_meters"),
            estimated_pace=data.get("estimated_pace"),
            max_participants=data.get("max_participants"),
            is_open=data.get("is_open", False),
            status="upcoming",
            participant_count=1,
        )
        db.add(scheduled_run)
        await db.flush()

        # Organizer auto-RSVPs as 'going'
        participant = ScheduledRunParticipant(
            scheduled_run_id=scheduled_run.id,
            user_id=organizer_id,
            status="going",
        )
        db.add(participant)
        await db.flush()
        await db.refresh(scheduled_run)

        return await self._run_to_dict(db, scheduled_run, organizer_id)

    async def update_scheduled_run(
        self,
        db: AsyncSession,
        scheduled_run_id: UUID,
        user_id: UUID,
        data: dict,
    ) -> dict:
        run = await self._get_run_or_404(db, scheduled_run_id)

        if run.organizer_id != user_id:
            member = await self._get_membership(db, run.crew_id, user_id)
            if not member or member.role not in ("owner", "admin"):
                raise PermissionDeniedError(
                    code="PERMISSION_DENIED",
                    message="일정 수정 권한이 없습니다",
                )

        if run.status != "upcoming":
            raise BadRequestError(
                code="CANNOT_UPDATE",
                message="예정된 일정만 수정할 수 있습니다",
            )

        for field in (
            "title", "description", "scheduled_at",
            "location_name", "location_lat", "location_lng",
            "estimated_distance_meters", "estimated_pace",
            "max_participants", "is_open",
        ):
            if field in data and data[field] is not None:
                setattr(run, field, data[field])

        await db.flush()
        await db.refresh(run)
        return await self._run_to_dict(db, run, user_id)

    async def cancel_run(
        self,
        db: AsyncSession,
        scheduled_run_id: UUID,
        user_id: UUID,
    ) -> None:
        run = await self._get_run_or_404(db, scheduled_run_id)

        if run.organizer_id != user_id:
            member = await self._get_membership(db, run.crew_id, user_id)
            if not member or member.role not in ("owner", "admin"):
                raise PermissionDeniedError(
                    code="PERMISSION_DENIED",
                    message="일정 취소 권한이 없습니다",
                )

        if run.status not in ("upcoming",):
            raise BadRequestError(
                code="CANNOT_CANCEL",
                message="예정된 일정만 취소할 수 있습니다",
            )

        run.status = "cancelled"
        await db.flush()

    # ------------------------------------------------------------------
    # RSVP
    # ------------------------------------------------------------------

    async def update_rsvp(
        self,
        db: AsyncSession,
        scheduled_run_id: UUID,
        user_id: UUID,
        status: str,
    ) -> dict:
        run = await self._get_run_or_404(db, scheduled_run_id)

        if run.status != "upcoming":
            raise BadRequestError(
                code="RUN_NOT_UPCOMING",
                message="예정된 일정에만 참여할 수 있습니다",
            )

        # Check membership: crew members always allowed, non-members only if open
        member = await self._get_membership(db, run.crew_id, user_id)
        if member is None and not run.is_open:
            raise PermissionDeniedError(
                code="NOT_CREW_MEMBER",
                message="크루 멤버만 참여할 수 있습니다",
            )

        # Check capacity for 'going' status
        if status == "going" and run.max_participants:
            going_count_result = await db.execute(
                select(func.count(ScheduledRunParticipant.id)).where(
                    ScheduledRunParticipant.scheduled_run_id == scheduled_run_id,
                    ScheduledRunParticipant.status == "going",
                )
            )
            going_count = going_count_result.scalar_one()
            if going_count >= run.max_participants:
                raise BadRequestError(
                    code="RUN_FULL",
                    message="참여 인원이 가득 찼습니다",
                )

        # Upsert participant
        existing = await self._get_participant(db, scheduled_run_id, user_id)
        if existing:
            old_status = existing.status
            existing.status = status
        else:
            old_status = None
            participant = ScheduledRunParticipant(
                scheduled_run_id=scheduled_run_id,
                user_id=user_id,
                status=status,
            )
            db.add(participant)

        # Update participant_count (count of 'going')
        await db.flush()
        going_result = await db.execute(
            select(func.count(ScheduledRunParticipant.id)).where(
                ScheduledRunParticipant.scheduled_run_id == scheduled_run_id,
                ScheduledRunParticipant.status == "going",
            )
        )
        run.participant_count = going_result.scalar_one()
        await db.flush()
        await db.refresh(run)

        return await self._run_to_dict(db, run, user_id)

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    async def get_scheduled_run(
        self,
        db: AsyncSession,
        scheduled_run_id: UUID,
        user_id: UUID | None = None,
    ) -> dict:
        run = await self._get_run_or_404(db, scheduled_run_id)
        return await self._run_to_dict(db, run, user_id)

    async def get_upcoming_runs_for_crew(
        self,
        db: AsyncSession,
        crew_id: UUID,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> tuple[list[dict], int]:
        await self._assert_crew_member(db, crew_id, user_id)

        filters = [
            ScheduledRun.crew_id == crew_id,
            ScheduledRun.status == "upcoming",
        ]

        count_result = await db.execute(
            select(func.count(ScheduledRun.id)).where(*filters)
        )
        total = count_result.scalar_one()

        result = await db.execute(
            select(ScheduledRun)
            .where(*filters)
            .options(joinedload(ScheduledRun.organizer))
            .order_by(ScheduledRun.scheduled_at.asc())
            .offset(page * per_page)
            .limit(per_page)
        )
        runs = result.scalars().unique().all()

        return [
            await self._run_to_dict(db, r, user_id) for r in runs
        ], total

    async def get_upcoming_runs_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> tuple[list[dict], int]:
        """Get all upcoming scheduled runs the user has RSVP'd 'going' to."""
        count_result = await db.execute(
            select(func.count(ScheduledRun.id))
            .select_from(ScheduledRun)
            .join(
                ScheduledRunParticipant,
                ScheduledRunParticipant.scheduled_run_id == ScheduledRun.id,
            )
            .where(
                ScheduledRunParticipant.user_id == user_id,
                ScheduledRunParticipant.status == "going",
                ScheduledRun.status == "upcoming",
            )
        )
        total = count_result.scalar_one()

        result = await db.execute(
            select(ScheduledRun)
            .join(
                ScheduledRunParticipant,
                ScheduledRunParticipant.scheduled_run_id == ScheduledRun.id,
            )
            .where(
                ScheduledRunParticipant.user_id == user_id,
                ScheduledRunParticipant.status == "going",
                ScheduledRun.status == "upcoming",
            )
            .options(joinedload(ScheduledRun.organizer))
            .order_by(ScheduledRun.scheduled_at.asc())
            .offset(page * per_page)
            .limit(per_page)
        )
        runs = result.scalars().unique().all()

        return [
            await self._run_to_dict(db, r, user_id) for r in runs
        ], total

    async def get_run_participants(
        self,
        db: AsyncSession,
        scheduled_run_id: UUID,
    ) -> list[dict]:
        await self._get_run_or_404(db, scheduled_run_id)

        result = await db.execute(
            select(ScheduledRunParticipant)
            .where(
                ScheduledRunParticipant.scheduled_run_id == scheduled_run_id
            )
            .options(joinedload(ScheduledRunParticipant.user))
            .order_by(ScheduledRunParticipant.joined_at.asc())
        )
        participants = result.scalars().unique().all()

        return [self._participant_to_dict(p) for p in participants]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_run_or_404(
        self, db: AsyncSession, scheduled_run_id: UUID
    ) -> ScheduledRun:
        result = await db.execute(
            select(ScheduledRun)
            .where(ScheduledRun.id == scheduled_run_id)
            .options(joinedload(ScheduledRun.organizer))
        )
        run = result.scalar_one_or_none()
        if run is None:
            raise NotFoundError(
                code="SCHEDULED_RUN_NOT_FOUND",
                message="일정을 찾을 수 없습니다",
            )
        return run

    async def _get_membership(
        self, db: AsyncSession, crew_id: UUID, user_id: UUID
    ) -> CrewMember | None:
        result = await db.execute(
            select(CrewMember).where(
                CrewMember.crew_id == crew_id,
                CrewMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _assert_crew_member(
        self, db: AsyncSession, crew_id: UUID, user_id: UUID
    ) -> CrewMember:
        crew = await db.get(Crew, crew_id)
        if crew is None:
            raise NotFoundError(
                code="CREW_NOT_FOUND", message="크루를 찾을 수 없습니다"
            )

        member = await self._get_membership(db, crew_id, user_id)
        if member is None:
            raise PermissionDeniedError(
                code="NOT_CREW_MEMBER",
                message="크루 멤버만 접근할 수 있습니다",
            )
        return member

    async def _get_participant(
        self,
        db: AsyncSession,
        scheduled_run_id: UUID,
        user_id: UUID,
    ) -> ScheduledRunParticipant | None:
        result = await db.execute(
            select(ScheduledRunParticipant).where(
                ScheduledRunParticipant.scheduled_run_id == scheduled_run_id,
                ScheduledRunParticipant.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _run_to_dict(
        self,
        db: AsyncSession,
        run: ScheduledRun,
        requesting_user_id: UUID | None,
    ) -> dict:
        # Get participants
        participants_result = await db.execute(
            select(ScheduledRunParticipant)
            .where(ScheduledRunParticipant.scheduled_run_id == run.id)
            .options(joinedload(ScheduledRunParticipant.user))
            .order_by(ScheduledRunParticipant.joined_at.asc())
        )
        participants = participants_result.scalars().unique().all()

        my_rsvp = None
        participant_list = []
        for p in participants:
            if requesting_user_id and p.user_id == requesting_user_id:
                my_rsvp = p.status
            participant_list.append(self._participant_to_dict(p))

        organizer = run.organizer
        return {
            "id": str(run.id),
            "crew_id": str(run.crew_id),
            "organizer": {
                "id": str(organizer.id) if organizer else "",
                "nickname": organizer.nickname if organizer else None,
                "avatar_url": organizer.avatar_url if organizer else None,
            },
            "title": run.title,
            "description": run.description,
            "scheduled_at": run.scheduled_at,
            "location_name": run.location_name,
            "location_lat": run.location_lat,
            "location_lng": run.location_lng,
            "estimated_distance_meters": run.estimated_distance_meters,
            "estimated_pace": run.estimated_pace,
            "max_participants": run.max_participants,
            "participant_count": run.participant_count,
            "status": run.status,
            "is_open": run.is_open,
            "my_rsvp": my_rsvp,
            "participants": participant_list,
            "created_at": run.created_at,
        }

    @staticmethod
    def _participant_to_dict(p: ScheduledRunParticipant) -> dict:
        user = p.user
        return {
            "user_id": str(p.user_id),
            "nickname": user.nickname if user else None,
            "avatar_url": user.avatar_url if user else None,
            "status": p.status,
            "joined_at": p.joined_at,
        }
