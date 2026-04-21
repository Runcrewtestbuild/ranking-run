"""Leaderboard service: multi-dimensional leaderboards."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ranking import Ranking
from app.models.run_record import RunRecord
from app.models.user import User

logger = logging.getLogger(__name__)

# Board types
BOARD_DISTANCE = "distance"
BOARD_COUNT = "count"
BOARD_PACE = "pace"
BOARD_ELEVATION = "elevation"
BOARD_STREAK = "streak"

VALID_BOARD_TYPES = {BOARD_DISTANCE, BOARD_COUNT, BOARD_PACE, BOARD_ELEVATION, BOARD_STREAK}


def _current_week_bounds() -> tuple[datetime, datetime]:
    """Return (Monday 00:00 UTC, next Monday 00:00 UTC) for the current week."""
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    return start, end


class LeaderboardService:
    """Handles multi-dimensional leaderboard queries."""

    async def get_weekly_distance(
        self,
        db: AsyncSession,
        page: int = 0,
        per_page: int = 20,
        region: str | None = None,
        country: str | None = None,
    ) -> dict:
        """Weekly distance leaderboard."""
        start, end = _current_week_bounds()
        return await self._weekly_aggregate(
            db=db,
            board_type=BOARD_DISTANCE,
            agg_expr=func.sum(RunRecord.distance_meters),
            start=start,
            end=end,
            page=page,
            per_page=per_page,
            region=region,
            country=country,
        )

    async def get_weekly_count(
        self,
        db: AsyncSession,
        page: int = 0,
        per_page: int = 20,
        region: str | None = None,
        country: str | None = None,
    ) -> dict:
        """Weekly run count leaderboard."""
        start, end = _current_week_bounds()
        return await self._weekly_aggregate(
            db=db,
            board_type=BOARD_COUNT,
            agg_expr=func.count(RunRecord.id),
            start=start,
            end=end,
            page=page,
            per_page=per_page,
            region=region,
            country=country,
        )

    async def get_weekly_pace(
        self,
        db: AsyncSession,
        page: int = 0,
        per_page: int = 20,
        region: str | None = None,
        country: str | None = None,
    ) -> dict:
        """Weekly best average pace leaderboard (lower is better).

        Calculates total_seconds / (total_meters/1000) per user.
        """
        start, end = _current_week_bounds()
        # Use raw SQL for pace calculation (seconds per km)
        pace_expr = (
            func.sum(RunRecord.duration_seconds)
            / func.nullif(func.sum(RunRecord.distance_meters) / 1000.0, 0)
        )

        return await self._weekly_aggregate(
            db=db,
            board_type=BOARD_PACE,
            agg_expr=pace_expr,
            start=start,
            end=end,
            page=page,
            per_page=per_page,
            region=region,
            country=country,
            ascending=True,  # Lower pace is better
            min_distance=1000,  # At least 1km to qualify
        )

    async def get_weekly_elevation(
        self,
        db: AsyncSession,
        page: int = 0,
        per_page: int = 20,
        region: str | None = None,
        country: str | None = None,
    ) -> dict:
        """Weekly total elevation gain leaderboard."""
        start, end = _current_week_bounds()
        return await self._weekly_aggregate(
            db=db,
            board_type=BOARD_ELEVATION,
            agg_expr=func.sum(RunRecord.elevation_gain_meters),
            start=start,
            end=end,
            page=page,
            per_page=per_page,
            region=region,
            country=country,
        )

    async def get_weekly_streak(
        self,
        db: AsyncSession,
        page: int = 0,
        per_page: int = 20,
        region: str | None = None,
        country: str | None = None,
    ) -> dict:
        """Weekly streak leaderboard: distinct running days."""
        start, end = _current_week_bounds()
        streak_expr = func.count(
            func.distinct(func.date_trunc("day", RunRecord.finished_at))
        )
        return await self._weekly_aggregate(
            db=db,
            board_type=BOARD_STREAK,
            agg_expr=streak_expr,
            start=start,
            end=end,
            page=page,
            per_page=per_page,
            region=region,
            country=country,
        )

    async def get_course_records(
        self,
        db: AsyncSession,
        course_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> dict:
        """Get course records sorted by best duration."""
        base_filter = Ranking.course_id == course_id

        count_result = await db.execute(
            select(func.count(Ranking.id)).where(base_filter)
        )
        total = count_result.scalar_one()

        result = await db.execute(
            select(Ranking)
            .where(base_filter)
            .order_by(Ranking.best_duration_seconds.asc())
            .offset(page * per_page)
            .limit(per_page)
        )
        rankings = result.scalars().all()

        data = []
        for rank_offset, r in enumerate(rankings, start=page * per_page + 1):
            data.append({
                "rank": rank_offset,
                "user": {
                    "id": str(r.user.id),
                    "nickname": r.user.nickname,
                    "avatar_url": r.user.avatar_url,
                    "crew_name": r.user.crew_name,
                    "runner_level": r.user.runner_level,
                },
                "duration_seconds": r.best_duration_seconds,
                "pace_seconds_per_km": r.best_pace_seconds_per_km,
                "achieved_at": r.achieved_at,
            })

        return {
            "course_id": str(course_id),
            "data": data,
            "total": total,
        }

    async def get_my_rank(
        self,
        db: AsyncSession,
        user_id: UUID,
        board_type: str,
    ) -> dict:
        """Get user's rank on a specific board with gap to next rank.

        Returns:
            Dict with rank, value, total_participants, gap_to_next, next_rank_value.
        """
        if board_type not in VALID_BOARD_TYPES:
            return {
                "board_type": board_type,
                "rank": None,
                "value": 0.0,
                "total_participants": 0,
                "gap_to_next": None,
                "next_rank_value": None,
            }

        start, end = _current_week_bounds()
        agg_expr, ascending, min_distance = self._get_agg_config(board_type)

        base_filter = and_(
            RunRecord.is_flagged.is_(False),
            RunRecord.finished_at >= start,
            RunRecord.finished_at < end,
        )
        if min_distance:
            base_filter = and_(base_filter, RunRecord.distance_meters >= min_distance)

        # Get all user aggregates
        order = "ASC" if ascending else "DESC"
        query = (
            select(RunRecord.user_id, agg_expr.label("val"))
            .where(base_filter)
            .group_by(RunRecord.user_id)
            .having(agg_expr > 0)
            .order_by(text(f"val {order}"))
        )
        result = await db.execute(query)
        rows = result.all()

        total_participants = len(rows)
        user_rank = None
        user_value = 0.0
        gap_to_next = None
        next_rank_value = None

        for idx, row in enumerate(rows):
            if row[0] == user_id:
                user_rank = idx + 1
                user_value = float(row[1])

                # Find the person one rank above
                if idx > 0:
                    next_rank_value = float(rows[idx - 1][1])
                    gap_to_next = abs(next_rank_value - user_value)
                break

        return {
            "board_type": board_type,
            "rank": user_rank,
            "value": user_value,
            "total_participants": total_participants,
            "gap_to_next": gap_to_next,
            "next_rank_value": next_rank_value,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_agg_config(self, board_type: str):
        """Return (agg_expression, ascending, min_distance) for a board type."""
        if board_type == BOARD_DISTANCE:
            return func.sum(RunRecord.distance_meters), False, None
        elif board_type == BOARD_COUNT:
            return func.count(RunRecord.id), False, None
        elif board_type == BOARD_PACE:
            pace = (
                func.sum(RunRecord.duration_seconds)
                / func.nullif(func.sum(RunRecord.distance_meters) / 1000.0, 0)
            )
            return pace, True, 1000
        elif board_type == BOARD_ELEVATION:
            return func.sum(RunRecord.elevation_gain_meters), False, None
        elif board_type == BOARD_STREAK:
            return func.count(
                func.distinct(func.date_trunc("day", RunRecord.finished_at))
            ), False, None
        # Fallback
        return func.sum(RunRecord.distance_meters), False, None

    async def _weekly_aggregate(
        self,
        db: AsyncSession,
        board_type: str,
        agg_expr,
        start: datetime,
        end: datetime,
        page: int,
        per_page: int,
        region: str | None = None,
        country: str | None = None,
        ascending: bool = False,
        min_distance: int | None = None,
    ) -> dict:
        """Generic weekly aggregate leaderboard builder."""
        base_filters = [
            RunRecord.is_flagged.is_(False),
            RunRecord.finished_at >= start,
            RunRecord.finished_at < end,
        ]
        if min_distance:
            base_filters.append(RunRecord.distance_meters >= min_distance)

        query = (
            select(RunRecord.user_id, agg_expr.label("val"))
            .where(*base_filters)
            .group_by(RunRecord.user_id)
            .having(agg_expr > 0)
        )

        # Apply region/country filtering via join
        if region or country:
            query = query.join(User, RunRecord.user_id == User.id)
            if region:
                query = query.where(User.activity_region == region)
            if country:
                query = query.where(User.country == country)

        # Count total participants
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        # Paginated results
        order_col = text("val ASC") if ascending else text("val DESC")
        paginated = (
            query
            .order_by(order_col)
            .offset(page * per_page)
            .limit(per_page)
        )
        result = await db.execute(paginated)
        rows = result.all()

        # Batch-load user info
        user_ids = [r[0] for r in rows]
        users_map = await self._load_users(db, user_ids)

        data = []
        for offset, row in enumerate(rows):
            uid, val = row
            user = users_map.get(uid)
            if user is None:
                continue
            data.append({
                "rank": page * per_page + offset + 1,
                "user": {
                    "id": str(user.id),
                    "nickname": user.nickname,
                    "avatar_url": user.avatar_url,
                    "crew_name": user.crew_name,
                    "runner_level": user.runner_level,
                },
                "value": float(val),
            })

        return {
            "board_type": board_type,
            "data": data,
            "period_start": start,
            "period_end": end,
            "total": total,
        }

    async def _load_users(
        self, db: AsyncSession, user_ids: list[UUID]
    ) -> dict[UUID, User]:
        if not user_ids:
            return {}
        result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        return {u.id: u for u in result.scalars().all()}
