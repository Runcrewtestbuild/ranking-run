"""Versus service: manage 1:1 battle matches."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.models.run_record import RunRecord
from app.models.user import User
from app.models.versus import VersusMatch

logger = logging.getLogger(__name__)

# Maximum concurrent active matches per user
MAX_ACTIVE_MATCHES = 5


class VersusService:
    """Handles 1:1 versus match lifecycle."""

    async def create_match(
        self,
        db: AsyncSession,
        challenger_id: UUID,
        opponent_id: UUID,
        metric: str,
        duration_days: int,
    ) -> dict:
        """Create a new versus match challenge.

        Raises:
            ValidationError: Invalid metric or self-challenge.
            NotFoundError: Opponent does not exist.
            ConflictError: Active match limit reached or duplicate pending match.
        """
        if challenger_id == opponent_id:
            raise ValidationError(
                code="SELF_CHALLENGE", message="자기 자신에게 도전할 수 없습니다"
            )

        if metric not in ("distance", "count", "pace"):
            raise ValidationError(
                code="INVALID_METRIC",
                message="유효하지 않은 지표입니다 (distance, count, pace)",
            )

        # Verify opponent exists
        opponent = await db.execute(
            select(User.id).where(User.id == opponent_id)
        )
        if opponent.scalar_one_or_none() is None:
            raise NotFoundError(
                code="USER_NOT_FOUND", message="상대방을 찾을 수 없습니다"
            )

        # Check active match limit
        active_count = await self._count_active_matches(db, challenger_id)
        if active_count >= MAX_ACTIVE_MATCHES:
            raise ConflictError(
                code="MATCH_LIMIT_REACHED",
                message=f"동시에 진행할 수 있는 대결은 최대 {MAX_ACTIVE_MATCHES}개입니다",
            )

        # Check duplicate pending match between same users
        dup = await db.execute(
            select(VersusMatch.id).where(
                VersusMatch.status == "pending",
                or_(
                    and_(
                        VersusMatch.challenger_id == challenger_id,
                        VersusMatch.opponent_id == opponent_id,
                    ),
                    and_(
                        VersusMatch.challenger_id == opponent_id,
                        VersusMatch.opponent_id == challenger_id,
                    ),
                ),
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise ConflictError(
                code="DUPLICATE_MATCH",
                message="이미 대기 중인 대결이 있습니다",
            )

        match = VersusMatch(
            challenger_id=challenger_id,
            opponent_id=opponent_id,
            metric=metric,
            duration_days=duration_days,
            status="pending",
        )
        db.add(match)
        await db.flush()
        await db.refresh(match)

        return self._match_to_dict(match)

    async def accept_match(
        self,
        db: AsyncSession,
        match_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Accept a pending match (only the opponent can accept).

        Raises:
            NotFoundError: Match not found.
            PermissionDeniedError: User is not the opponent.
            ValidationError: Match is not in pending status.
        """
        match = await self._get_match(db, match_id)

        if match.opponent_id != user_id:
            raise PermissionDeniedError(
                code="NOT_OPPONENT", message="대결 수락 권한이 없습니다"
            )

        if match.status != "pending":
            raise ValidationError(
                code="INVALID_STATUS",
                message="대기 중인 대결만 수락할 수 있습니다",
            )

        # Check opponent's active match limit
        active_count = await self._count_active_matches(db, user_id)
        if active_count >= MAX_ACTIVE_MATCHES:
            raise ConflictError(
                code="MATCH_LIMIT_REACHED",
                message=f"동시에 진행할 수 있는 대결은 최대 {MAX_ACTIVE_MATCHES}개입니다",
            )

        now = datetime.now(timezone.utc)
        match.status = "active"
        match.start_date = now
        match.end_date = now + timedelta(days=match.duration_days)

        await db.flush()
        await db.refresh(match)

        return self._match_to_dict(match)

    async def decline_match(
        self,
        db: AsyncSession,
        match_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Decline a pending match (opponent) or cancel (challenger).

        Raises:
            NotFoundError: Match not found.
            PermissionDeniedError: User is not a participant.
            ValidationError: Match is not in pending status.
        """
        match = await self._get_match(db, match_id)

        if user_id not in (match.challenger_id, match.opponent_id):
            raise PermissionDeniedError(
                code="NOT_PARTICIPANT", message="대결 참여자가 아닙니다"
            )

        if match.status != "pending":
            raise ValidationError(
                code="INVALID_STATUS",
                message="대기 중인 대결만 거절/취소할 수 있습니다",
            )

        if user_id == match.opponent_id:
            match.status = "declined"
        else:
            match.status = "cancelled"

        await db.flush()
        await db.refresh(match)

        return self._match_to_dict(match)

    async def get_active_matches(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> tuple[list[dict], int]:
        """Get all active and pending matches for a user.

        Returns:
            Tuple of (match dicts, total count).
        """
        base_filter = and_(
            VersusMatch.status.in_(["pending", "active"]),
            or_(
                VersusMatch.challenger_id == user_id,
                VersusMatch.opponent_id == user_id,
            ),
        )

        count_result = await db.execute(
            select(func.count(VersusMatch.id)).where(base_filter)
        )
        total = count_result.scalar_one()

        result = await db.execute(
            select(VersusMatch)
            .where(base_filter)
            .order_by(VersusMatch.created_at.desc())
        )
        matches = result.scalars().all()

        return [self._match_to_dict(m) for m in matches], total

    async def get_match_history(
        self,
        db: AsyncSession,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> tuple[list[dict], int]:
        """Get completed/declined/cancelled matches for a user."""
        base_filter = and_(
            VersusMatch.status.in_(["completed", "declined", "cancelled"]),
            or_(
                VersusMatch.challenger_id == user_id,
                VersusMatch.opponent_id == user_id,
            ),
        )

        count_result = await db.execute(
            select(func.count(VersusMatch.id)).where(base_filter)
        )
        total = count_result.scalar_one()

        result = await db.execute(
            select(VersusMatch)
            .where(base_filter)
            .order_by(VersusMatch.created_at.desc())
            .offset(page * per_page)
            .limit(per_page)
        )
        matches = result.scalars().all()

        return [self._match_to_dict(m) for m in matches], total

    async def get_match_detail(
        self,
        db: AsyncSession,
        match_id: UUID,
    ) -> dict:
        """Get a single match with full detail.

        Raises:
            NotFoundError: Match not found.
        """
        match = await self._get_match(db, match_id)
        return self._match_to_dict(match)

    async def update_match_scores(self, db: AsyncSession) -> int:
        """Recalculate scores for all active matches from run records.

        Called periodically (e.g. by a background task after each run
        or by a scheduled job).

        Returns:
            Number of matches updated.
        """
        result = await db.execute(
            select(VersusMatch).where(VersusMatch.status == "active")
        )
        active_matches = result.scalars().all()

        updated = 0
        for match in active_matches:
            challenger_val = await self._calculate_user_value(
                db, match.challenger_id, match.metric,
                match.start_date, match.end_date,
            )
            opponent_val = await self._calculate_user_value(
                db, match.opponent_id, match.metric,
                match.start_date, match.end_date,
            )

            if (match.challenger_value != challenger_val
                    or match.opponent_value != opponent_val):
                match.challenger_value = challenger_val
                match.opponent_value = opponent_val
                updated += 1

        if updated > 0:
            await db.flush()

        return updated

    async def complete_expired_matches(self, db: AsyncSession) -> int:
        """Find active matches past their end_date and determine winners.

        Returns:
            Number of matches completed.
        """
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(VersusMatch).where(
                VersusMatch.status == "active",
                VersusMatch.end_date <= now,
            )
        )
        expired = result.scalars().all()

        completed = 0
        for match in expired:
            # Recalculate final scores
            match.challenger_value = await self._calculate_user_value(
                db, match.challenger_id, match.metric,
                match.start_date, match.end_date,
            )
            match.opponent_value = await self._calculate_user_value(
                db, match.opponent_id, match.metric,
                match.start_date, match.end_date,
            )

            # Determine winner (for pace, lower is better)
            if match.metric == "pace":
                if match.challenger_value > 0 and match.opponent_value > 0:
                    if match.challenger_value < match.opponent_value:
                        match.winner_id = match.challenger_id
                    elif match.opponent_value < match.challenger_value:
                        match.winner_id = match.opponent_id
                    # else: tie, winner_id stays None
                elif match.challenger_value > 0:
                    match.winner_id = match.challenger_id
                elif match.opponent_value > 0:
                    match.winner_id = match.opponent_id
            else:
                # For distance/count, higher is better
                if match.challenger_value > match.opponent_value:
                    match.winner_id = match.challenger_id
                elif match.opponent_value > match.challenger_value:
                    match.winner_id = match.opponent_id

            match.status = "completed"
            completed += 1

            # Send notifications
            try:
                from app.core.config import get_settings
                from app.services.notification_service import NotificationService

                svc = NotificationService(get_settings())
                winner_label = "무승부"
                if match.winner_id:
                    winner_label = "승리"

                for uid in (match.challenger_id, match.opponent_id):
                    is_winner = match.winner_id == uid
                    body = (
                        "대결이 종료되었습니다. 승리!" if is_winner
                        else "대결이 종료되었습니다." if match.winner_id
                        else "대결이 무승부로 종료되었습니다."
                    )
                    await svc.create_and_send(
                        db=db,
                        user_id=uid,
                        notification_type="versus_completed",
                        actor_id=uid,
                        title="대결 종료",
                        body=body,
                        target_id=str(match.id),
                        target_type="versus",
                    )
            except Exception:
                logger.warning(
                    "Failed to send versus_completed notification for match %s",
                    match.id,
                )

        if completed > 0:
            await db.flush()

        return completed

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_match(self, db: AsyncSession, match_id: UUID) -> VersusMatch:
        result = await db.execute(
            select(VersusMatch).where(VersusMatch.id == match_id)
        )
        match = result.scalar_one_or_none()
        if match is None:
            raise NotFoundError(
                code="MATCH_NOT_FOUND", message="대결을 찾을 수 없습니다"
            )
        return match

    async def _count_active_matches(self, db: AsyncSession, user_id: UUID) -> int:
        result = await db.execute(
            select(func.count(VersusMatch.id)).where(
                VersusMatch.status.in_(["active", "pending"]),
                or_(
                    VersusMatch.challenger_id == user_id,
                    VersusMatch.opponent_id == user_id,
                ),
            )
        )
        return result.scalar_one()

    async def _calculate_user_value(
        self,
        db: AsyncSession,
        user_id: UUID,
        metric: str,
        start_date: datetime,
        end_date: datetime,
    ) -> float:
        """Calculate a user's accumulated value for a metric during a time window."""
        base_filter = and_(
            RunRecord.user_id == user_id,
            RunRecord.is_flagged.is_(False),
            RunRecord.finished_at >= start_date,
            RunRecord.finished_at <= end_date,
        )

        if metric == "distance":
            result = await db.execute(
                select(func.coalesce(func.sum(RunRecord.distance_meters), 0))
                .where(base_filter)
            )
            return float(result.scalar_one())

        elif metric == "count":
            result = await db.execute(
                select(func.count(RunRecord.id)).where(base_filter)
            )
            return float(result.scalar_one())

        elif metric == "pace":
            # Average pace: total_duration / total_distance (seconds per km)
            result = await db.execute(
                select(
                    func.sum(RunRecord.duration_seconds),
                    func.sum(RunRecord.distance_meters),
                ).where(base_filter)
            )
            row = result.one()
            total_seconds, total_meters = row[0], row[1]
            if not total_seconds or not total_meters or total_meters == 0:
                return 0.0
            return float(total_seconds) / (float(total_meters) / 1000.0)

        return 0.0

    @staticmethod
    def _match_to_dict(match: VersusMatch) -> dict:
        return {
            "id": str(match.id),
            "challenger": {
                "id": str(match.challenger.id),
                "nickname": match.challenger.nickname,
                "avatar_url": match.challenger.avatar_url,
                "crew_name": match.challenger.crew_name,
                "runner_level": match.challenger.runner_level,
            },
            "opponent": {
                "id": str(match.opponent.id),
                "nickname": match.opponent.nickname,
                "avatar_url": match.opponent.avatar_url,
                "crew_name": match.opponent.crew_name,
                "runner_level": match.opponent.runner_level,
            },
            "status": match.status,
            "metric": match.metric,
            "duration_days": match.duration_days,
            "start_date": match.start_date,
            "end_date": match.end_date,
            "challenger_value": match.challenger_value,
            "opponent_value": match.opponent_value,
            "winner_id": str(match.winner_id) if match.winner_id else None,
            "created_at": match.created_at,
        }
