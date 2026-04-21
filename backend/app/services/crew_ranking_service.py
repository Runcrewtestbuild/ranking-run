"""Crew ranking service: crew leaderboard calculation and queries."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.crew import Crew, CrewMember
from app.models.crew_challenge import (
    CrewChallenge,
    CrewChallengeRecord,
    CrewCourseRanking,
)

logger = logging.getLogger(__name__)


class CrewRankingService:
    """Handles crew-level ranking calculation and leaderboard queries."""

    MIN_COMPLETED_FOR_RANKING = 2

    async def update_member_best(
        self,
        db: AsyncSession,
        challenge_id: UUID,
        user_id: UUID,
        duration_seconds: int,
        pace_seconds_per_km: int,
    ) -> None:
        """Update a member's best time in a crew challenge and recalculate ranking."""
        result = await db.execute(
            select(CrewChallengeRecord).where(
                CrewChallengeRecord.challenge_id == challenge_id,
                CrewChallengeRecord.user_id == user_id,
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            # Auto-create record on first run
            record = CrewChallengeRecord(
                challenge_id=challenge_id,
                user_id=user_id,
                run_count=0,
            )
            db.add(record)
            await db.flush()

        # Only update if better than previous best
        if (
            record.best_duration_seconds is None
            or duration_seconds < record.best_duration_seconds
        ):
            record.best_duration_seconds = duration_seconds
            record.best_pace_seconds_per_km = pace_seconds_per_km
            record.completed_at = datetime.now(timezone.utc)

        record.run_count += 1
        await db.flush()

        # Recalculate crew ranking
        challenge = await db.get(CrewChallenge, challenge_id)
        if challenge:
            await self.update_crew_ranking(db, challenge_id)
            await self.recalculate_crew_ranks(db, challenge.course_id)

    async def update_crew_ranking(
        self,
        db: AsyncSession,
        crew_challenge_id: UUID,
    ) -> None:
        """Recalculate and upsert crew ranking based on completed records."""
        challenge = await db.get(CrewChallenge, crew_challenge_id)
        if challenge is None:
            return

        # Get records with completed times
        result = await db.execute(
            select(CrewChallengeRecord).where(
                CrewChallengeRecord.challenge_id == crew_challenge_id,
                CrewChallengeRecord.best_duration_seconds.is_not(None),
            )
        )
        completed_records = result.scalars().all()
        completed_count = len(completed_records)

        # Get or find existing ranking entry for (course_id, crew_id)
        ranking_result = await db.execute(
            select(CrewCourseRanking).where(
                CrewCourseRanking.course_id == challenge.course_id,
                CrewCourseRanking.crew_id == challenge.crew_id,
            )
        )
        ranking = ranking_result.scalar_one_or_none()

        if completed_count < self.MIN_COMPLETED_FOR_RANKING:
            # Remove ranking if exists but not enough completions
            if ranking:
                await db.delete(ranking)
                await db.flush()
            return

        # Calculate average duration
        total_duration = sum(r.best_duration_seconds for r in completed_records)
        avg_duration = total_duration // completed_count

        # Get crew info
        crew = await db.get(Crew, challenge.crew_id)
        crew_name = crew.name if crew else "Unknown"
        total_participants = crew.member_count if crew else 0

        now = datetime.now(timezone.utc)

        if ranking:
            # Check if new average is better before updating achieved_at
            is_better = avg_duration < ranking.avg_duration_seconds
            ranking.avg_duration_seconds = avg_duration
            ranking.completed_count = completed_count
            ranking.total_participants = total_participants
            ranking.crew_name = crew_name
            ranking.crew_challenge_id = challenge.id
            ranking.updated_at = now
            if is_better or ranking.achieved_at is None:
                ranking.achieved_at = now
        else:
            ranking = CrewCourseRanking(
                course_id=challenge.course_id,
                crew_id=challenge.crew_id,
                crew_challenge_id=challenge.id,
                crew_name=crew_name,
                avg_duration_seconds=avg_duration,
                completed_count=completed_count,
                total_participants=total_participants,
                achieved_at=now,
                updated_at=now,
            )
            db.add(ranking)

        await db.flush()

    async def recalculate_crew_ranks(
        self,
        db: AsyncSession,
        course_id: UUID,
    ) -> None:
        """Recalculate cached rank values for all crew rankings on a course."""
        result = await db.execute(
            select(CrewCourseRanking)
            .where(CrewCourseRanking.course_id == course_id)
            .order_by(CrewCourseRanking.avg_duration_seconds)
        )
        rankings = result.scalars().all()

        for i, ranking in enumerate(rankings):
            ranking.rank = i + 1

        await db.flush()

    async def get_course_crew_rankings(
        self,
        db: AsyncSession,
        course_id: UUID,
        page: int = 0,
        per_page: int = 20,
        requesting_user_id: UUID | None = None,
    ) -> dict:
        """Get paginated crew ranking leaderboard for a course."""
        # Total count
        total_result = await db.execute(
            select(func.count(CrewCourseRanking.id)).where(
                CrewCourseRanking.course_id == course_id
            )
        )
        total_crews = total_result.scalar() or 0

        # Paginated rankings with crew info
        result = await db.execute(
            select(CrewCourseRanking)
            .where(CrewCourseRanking.course_id == course_id)
            .options(joinedload(CrewCourseRanking.crew))
            .order_by(CrewCourseRanking.avg_duration_seconds)
            .offset(page * per_page)
            .limit(per_page)
        )
        rankings = result.scalars().unique().all()

        data = []
        for i, ranking in enumerate(rankings):
            rank = ranking.rank if ranking.rank else page * per_page + i + 1
            data.append(self._ranking_to_dict(ranking, rank))

        # Get requesting user's crews that might not be in the paginated result
        my_crews: list[dict] = []
        if requesting_user_id:
            # Find all crews this user belongs to
            member_result = await db.execute(
                select(CrewMember.crew_id).where(
                    CrewMember.user_id == requesting_user_id
                )
            )
            user_crew_ids = [row[0] for row in member_result.all()]

            if user_crew_ids:
                my_result = await db.execute(
                    select(CrewCourseRanking)
                    .where(
                        CrewCourseRanking.course_id == course_id,
                        CrewCourseRanking.crew_id.in_(user_crew_ids),
                    )
                    .options(joinedload(CrewCourseRanking.crew))
                )
                my_rankings = my_result.scalars().unique().all()

                for ranking in my_rankings:
                    # Skip if already in main data
                    if any(d["crew_id"] == str(ranking.crew_id) for d in data):
                        continue
                    rank = ranking.rank or 0
                    my_crews.append(self._ranking_to_dict(ranking, rank))

        return {
            "data": data,
            "my_crews": my_crews,
            "total_crews": total_crews,
        }

    # ------------------------------------------------------------------
    # Crew vs Crew weekly ranking (by total distance)
    # ------------------------------------------------------------------

    async def get_crew_weekly_ranking(
        self,
        db: AsyncSession,
        page: int = 0,
        per_page: int = 20,
        requesting_user_id: UUID | None = None,
    ) -> dict:
        """Rank all crews by aggregate member distance this week."""
        from datetime import timedelta

        from sqlalchemy import and_, desc

        from app.models.run_record import RunRecord

        now = datetime.now(timezone.utc)
        monday = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )

        # Subquery: each crew's weekly stats
        crew_stats = (
            select(
                CrewMember.crew_id,
                func.coalesce(func.sum(RunRecord.distance_meters), 0).label(
                    "total_distance"
                ),
                func.count(func.distinct(RunRecord.user_id)).label(
                    "active_runners"
                ),
            )
            .select_from(CrewMember)
            .join(
                RunRecord,
                and_(
                    RunRecord.user_id == CrewMember.user_id,
                    RunRecord.finished_at >= monday,
                ),
            )
            .group_by(CrewMember.crew_id)
            .having(func.sum(RunRecord.distance_meters) > 0)
            .subquery()
        )

        # Total count of crews with activity
        count_result = await db.execute(
            select(func.count()).select_from(crew_stats)
        )
        total_count = count_result.scalar_one()

        # Paginated ranking
        result = await db.execute(
            select(
                Crew.id,
                Crew.name,
                Crew.logo_url,
                Crew.badge_color,
                Crew.member_count,
                crew_stats.c.total_distance,
                crew_stats.c.active_runners,
            )
            .join(crew_stats, crew_stats.c.crew_id == Crew.id)
            .order_by(desc(crew_stats.c.total_distance))
            .offset(page * per_page)
            .limit(per_page)
        )
        rows = result.all()

        data = []
        for i, row in enumerate(rows):
            data.append({
                "rank": page * per_page + i + 1,
                "crew_id": str(row.id),
                "crew_name": row.name,
                "crew_logo_url": row.logo_url,
                "crew_badge_color": row.badge_color,
                "member_count": row.member_count,
                "total_distance_meters": row.total_distance,
                "active_runners": row.active_runners,
                "avg_pace_seconds_per_km": None,
            })

        # Find requesting user's crew ranking if not in page
        my_crew_entry = None
        if requesting_user_id:
            my_crew_entry = await self._get_my_crew_weekly_rank(
                db, requesting_user_id, monday, data
            )

        return {
            "data": data,
            "total_count": total_count,
            "my_crew": my_crew_entry,
        }

    async def _get_my_crew_weekly_rank(
        self,
        db: AsyncSession,
        user_id: UUID,
        monday: datetime,
        already_in_data: list[dict],
    ) -> dict | None:
        """Find the user's primary crew weekly ranking."""
        from sqlalchemy import and_, desc

        from app.models.run_record import RunRecord
        from app.models.user import User

        # Find user's primary crew
        user_result = await db.execute(
            select(User.crew_name).where(User.id == user_id)
        )
        crew_name = user_result.scalar_one_or_none()
        if not crew_name:
            return None

        # Find crew by name
        crew_result = await db.execute(
            select(Crew).where(Crew.name == crew_name).limit(1)
        )
        crew = crew_result.scalar_one_or_none()
        if crew is None:
            return None

        # Check if already in paginated data
        for entry in already_in_data:
            if entry["crew_id"] == str(crew.id):
                return None

        # Calculate this crew's weekly stats
        stats_result = await db.execute(
            select(
                func.coalesce(func.sum(RunRecord.distance_meters), 0).label(
                    "total_distance"
                ),
                func.count(func.distinct(RunRecord.user_id)).label(
                    "active_runners"
                ),
            )
            .select_from(CrewMember)
            .join(
                RunRecord,
                and_(
                    RunRecord.user_id == CrewMember.user_id,
                    RunRecord.finished_at >= monday,
                ),
            )
            .where(CrewMember.crew_id == crew.id)
        )
        stats = stats_result.one()

        if stats.total_distance == 0:
            return None

        # Calculate rank (how many crews have more distance)
        rank_result = await db.execute(
            select(func.count())
            .select_from(
                select(CrewMember.crew_id)
                .join(
                    RunRecord,
                    and_(
                        RunRecord.user_id == CrewMember.user_id,
                        RunRecord.finished_at >= monday,
                    ),
                )
                .group_by(CrewMember.crew_id)
                .having(
                    func.sum(RunRecord.distance_meters) > stats.total_distance
                )
                .subquery()
            )
        )
        crews_ahead = rank_result.scalar_one()

        return {
            "rank": crews_ahead + 1,
            "crew_id": str(crew.id),
            "crew_name": crew.name,
            "crew_logo_url": crew.logo_url,
            "crew_badge_color": crew.badge_color,
            "member_count": crew.member_count,
            "total_distance_meters": stats.total_distance,
            "active_runners": stats.active_runners,
            "avg_pace_seconds_per_km": None,
        }

    async def get_crew_detail_stats(
        self,
        db: AsyncSession,
        crew_id: UUID,
    ) -> dict:
        """Detailed crew stats: all-time + this week."""
        from datetime import timedelta

        from sqlalchemy import and_

        from app.models.run_record import RunRecord

        crew = await db.get(Crew, crew_id)
        if crew is None:
            from app.core.exceptions import NotFoundError

            raise NotFoundError(
                code="CREW_NOT_FOUND", message="크루를 찾을 수 없습니다"
            )

        now = datetime.now(timezone.utc)
        monday = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )

        # All-time stats
        alltime_result = await db.execute(
            select(
                func.coalesce(func.sum(RunRecord.distance_meters), 0).label(
                    "total_distance"
                ),
                func.count(func.distinct(RunRecord.user_id)).label(
                    "active_runners"
                ),
                func.count(RunRecord.id).label("total_runs"),
            )
            .select_from(CrewMember)
            .join(
                RunRecord,
                RunRecord.user_id == CrewMember.user_id,
            )
            .where(CrewMember.crew_id == crew_id)
        )
        alltime = alltime_result.one()

        # This week's stats
        weekly_result = await db.execute(
            select(
                func.coalesce(func.sum(RunRecord.distance_meters), 0).label(
                    "weekly_distance"
                ),
                func.count(RunRecord.id).label("weekly_runs"),
            )
            .select_from(CrewMember)
            .join(
                RunRecord,
                and_(
                    RunRecord.user_id == CrewMember.user_id,
                    RunRecord.finished_at >= monday,
                ),
            )
            .where(CrewMember.crew_id == crew_id)
        )
        weekly = weekly_result.one()

        # Avg pace (all-time, only records with pace data)
        pace_result = await db.execute(
            select(
                func.avg(RunRecord.pace_seconds_per_km).label("avg_pace"),
            )
            .select_from(CrewMember)
            .join(
                RunRecord,
                and_(
                    RunRecord.user_id == CrewMember.user_id,
                    RunRecord.pace_seconds_per_km.is_not(None),
                ),
            )
            .where(CrewMember.crew_id == crew_id)
        )
        avg_pace_raw = pace_result.scalar_one_or_none()
        avg_pace = int(avg_pace_raw) if avg_pace_raw else None

        return {
            "crew_id": str(crew.id),
            "crew_name": crew.name,
            "total_distance_meters": alltime.total_distance,
            "active_runners": alltime.active_runners,
            "total_runs": alltime.total_runs,
            "avg_pace_seconds_per_km": avg_pace,
            "weekly_distance_meters": weekly.weekly_distance,
            "weekly_runs": weekly.weekly_runs,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _ranking_to_dict(ranking: CrewCourseRanking, rank: int) -> dict:
        """Convert a CrewCourseRanking to a response dictionary."""
        crew = ranking.crew
        return {
            "rank": rank,
            "crew_id": str(ranking.crew_id),
            "crew_name": ranking.crew_name,
            "crew_logo_url": crew.logo_url if crew else None,
            "crew_badge_color": crew.badge_color if crew else None,
            "avg_duration_seconds": ranking.avg_duration_seconds,
            "completed_count": ranking.completed_count,
            "total_participants": ranking.total_participants,
            "achieved_at": ranking.achieved_at,
        }
