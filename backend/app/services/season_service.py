"""Season service: season lifecycle, points, tiers, and leaderboards."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError
from app.models.run_record import RunRecord
from app.models.season import Season, SeasonRanking
from app.models.user import User

logger = logging.getLogger(__name__)

# Tier thresholds (points required)
TIER_THRESHOLDS = [
    ("diamond", 10000),
    ("platinum", 5000),
    ("gold", 2000),
    ("silver", 500),
    ("bronze", 0),
]

# Points awarded per activity
POINTS_PER_KM = 10
POINTS_PER_RUN = 50
POINTS_PER_ELEVATION_100M = 20


class SeasonService:
    """Handles season management, tier calculations, and season leaderboards."""

    async def get_current_season(self, db: AsyncSession) -> dict | None:
        """Get the currently active season, or None if no season is active."""
        result = await db.execute(
            select(Season)
            .where(Season.is_active.is_(True))
            .order_by(Season.start_date.desc())
            .limit(1)
        )
        season = result.scalar_one_or_none()
        if season is None:
            return None

        return self._season_to_dict(season)

    async def get_season_by_id(self, db: AsyncSession, season_id: UUID) -> dict:
        """Get a season by ID.

        Raises:
            NotFoundError: Season not found.
        """
        result = await db.execute(
            select(Season).where(Season.id == season_id)
        )
        season = result.scalar_one_or_none()
        if season is None:
            raise NotFoundError(
                code="SEASON_NOT_FOUND", message="시즌을 찾을 수 없습니다"
            )
        return self._season_to_dict(season)

    async def get_user_season_rank(
        self,
        db: AsyncSession,
        user_id: UUID,
        season_id: UUID,
    ) -> dict:
        """Get a user's ranking for a specific season.

        If the user has no ranking record yet, calculates points and creates one.

        Returns:
            Dict with season info, tier, points, rank, and gap to next tier.
        """
        season = await self._get_season(db, season_id)

        # Find or create season ranking
        result = await db.execute(
            select(SeasonRanking).where(
                SeasonRanking.user_id == user_id,
                SeasonRanking.season_id == season_id,
            )
        )
        ranking = result.scalar_one_or_none()

        if ranking is None:
            # Calculate and create
            points = await self._calculate_points(
                db, user_id, season.start_date, season.end_date,
            )
            tier = determine_tier(points)
            ranking = SeasonRanking(
                user_id=user_id,
                season_id=season_id,
                tier=tier,
                points=points,
            )
            db.add(ranking)
            await db.flush()
            await db.refresh(ranking)

        # Calculate rank among all users in this season
        rank = await self._calculate_rank(db, season_id, ranking.points)
        ranking.rank = rank

        # Next tier info
        next_tier, points_to_next = _next_tier_info(ranking.points)

        return {
            "season": self._season_to_dict(season),
            "tier": ranking.tier,
            "points": ranking.points,
            "rank": rank,
            "next_tier": next_tier,
            "points_to_next_tier": points_to_next,
        }

    async def calculate_season_points(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> int:
        """Calculate and update season points for the current active season.

        Returns:
            Updated points, or 0 if no active season.
        """
        result = await db.execute(
            select(Season)
            .where(Season.is_active.is_(True))
            .order_by(Season.start_date.desc())
            .limit(1)
        )
        season = result.scalar_one_or_none()
        if season is None:
            return 0

        points = await self._calculate_points(
            db, user_id, season.start_date, season.end_date,
        )
        tier = determine_tier(points)

        # Upsert season ranking
        result = await db.execute(
            select(SeasonRanking).where(
                SeasonRanking.user_id == user_id,
                SeasonRanking.season_id == season.id,
            )
        )
        ranking = result.scalar_one_or_none()

        if ranking is None:
            ranking = SeasonRanking(
                user_id=user_id,
                season_id=season.id,
                tier=tier,
                points=points,
            )
            db.add(ranking)
        else:
            ranking.points = points
            ranking.tier = tier

        await db.flush()
        return points

    async def get_season_leaderboard(
        self,
        db: AsyncSession,
        season_id: UUID,
        tier: str | None = None,
        page: int = 0,
        per_page: int = 20,
        requesting_user_id: UUID | None = None,
    ) -> dict:
        """Get season leaderboard, optionally filtered by tier.

        Returns:
            Dict with data, my_ranking, season, total.
        """
        season = await self._get_season(db, season_id)

        base_filters = [SeasonRanking.season_id == season_id]
        if tier:
            base_filters.append(SeasonRanking.tier == tier)

        # Total
        count_result = await db.execute(
            select(func.count(SeasonRanking.id)).where(*base_filters)
        )
        total = count_result.scalar_one()

        # Paginated results
        result = await db.execute(
            select(SeasonRanking)
            .options(joinedload(SeasonRanking.user))
            .where(*base_filters)
            .order_by(SeasonRanking.points.desc())
            .offset(page * per_page)
            .limit(per_page)
        )
        rankings = result.scalars().all()

        data = []
        for offset, r in enumerate(rankings):
            data.append({
                "rank": page * per_page + offset + 1,
                "user": {
                    "id": str(r.user.id),
                    "nickname": r.user.nickname,
                    "avatar_url": r.user.avatar_url,
                    "crew_name": r.user.crew_name,
                    "runner_level": r.user.runner_level,
                },
                "tier": r.tier,
                "points": r.points,
            })

        # My ranking
        my_ranking = None
        if requesting_user_id:
            my_result = await db.execute(
                select(SeasonRanking)
                .options(joinedload(SeasonRanking.user))
                .where(
                    SeasonRanking.season_id == season_id,
                    SeasonRanking.user_id == requesting_user_id,
                )
            )
            my_sr = my_result.scalar_one_or_none()
            if my_sr:
                my_rank = await self._calculate_rank(
                    db, season_id, my_sr.points
                )
                my_ranking = {
                    "rank": my_rank,
                    "user": {
                        "id": str(my_sr.user.id),
                        "nickname": my_sr.user.nickname,
                        "avatar_url": my_sr.user.avatar_url,
                        "crew_name": my_sr.user.crew_name,
                        "runner_level": my_sr.user.runner_level,
                    },
                    "tier": my_sr.tier,
                    "points": my_sr.points,
                }

        return {
            "data": data,
            "my_ranking": my_ranking,
            "season": self._season_to_dict(season),
            "total": total,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_season(self, db: AsyncSession, season_id: UUID) -> Season:
        result = await db.execute(
            select(Season).where(Season.id == season_id)
        )
        season = result.scalar_one_or_none()
        if season is None:
            raise NotFoundError(
                code="SEASON_NOT_FOUND", message="시즌을 찾을 수 없습니다"
            )
        return season

    async def _calculate_points(
        self,
        db: AsyncSession,
        user_id: UUID,
        start_date: datetime,
        end_date: datetime,
    ) -> int:
        """Calculate season points from run records within the season window."""
        result = await db.execute(
            select(
                func.coalesce(func.sum(RunRecord.distance_meters), 0),
                func.count(RunRecord.id),
                func.coalesce(func.sum(RunRecord.elevation_gain_meters), 0),
            ).where(
                RunRecord.user_id == user_id,
                RunRecord.is_flagged.is_(False),
                RunRecord.finished_at >= start_date,
                RunRecord.finished_at <= end_date,
            )
        )
        row = result.one()
        total_distance = int(row[0])
        run_count = int(row[1])
        total_elevation = int(row[2])

        points = (
            (total_distance // 1000) * POINTS_PER_KM
            + run_count * POINTS_PER_RUN
            + (total_elevation // 100) * POINTS_PER_ELEVATION_100M
        )
        return points

    async def _calculate_rank(
        self,
        db: AsyncSession,
        season_id: UUID,
        points: int,
    ) -> int:
        """Calculate rank as 1 + count of users with more points."""
        result = await db.execute(
            select(func.count(SeasonRanking.id)).where(
                SeasonRanking.season_id == season_id,
                SeasonRanking.points > points,
            )
        )
        return result.scalar_one() + 1

    @staticmethod
    def _season_to_dict(season: Season) -> dict:
        return {
            "id": str(season.id),
            "name": season.name,
            "start_date": season.start_date,
            "end_date": season.end_date,
            "is_active": season.is_active,
        }


def determine_tier(points: int) -> str:
    """Determine tier name from points."""
    for tier_name, threshold in TIER_THRESHOLDS:
        if points >= threshold:
            return tier_name
    return "bronze"


def _next_tier_info(points: int) -> tuple[str | None, int | None]:
    """Return the next tier name and points needed, or None if at max."""
    current_tier = determine_tier(points)
    for i, (tier_name, threshold) in enumerate(TIER_THRESHOLDS):
        if tier_name == current_tier:
            if i == 0:
                # Already at highest tier
                return None, None
            next_tier_name, next_threshold = TIER_THRESHOLDS[i - 1]
            return next_tier_name, next_threshold - points
    return None, None
