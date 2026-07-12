"""Feed service: create and query activity feed items."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError
from app.models.activity_feed import ActivityFeed
from app.models.follow import Follow
from app.models.reaction import Reaction
from app.models.run_record import RunRecord
from app.models.user import User

logger = logging.getLogger(__name__)

VALID_ACTIVITY_TYPES = {
    "run_completed",
    "pr_achieved",
    "challenge_completed",
    "crew_joined",
    "streak_milestone",
    "post",
}


class FeedService:
    """Handles activity feed creation and retrieval."""

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_activity(
        self,
        db: AsyncSession,
        user_id: UUID,
        activity_type: str,
        run_record_id: UUID | None = None,
        content: str | None = None,
        image_urls: list[str] | None = None,
        metadata: dict | None = None,
    ) -> ActivityFeed:
        """Create a new activity feed item."""
        activity = ActivityFeed(
            user_id=user_id,
            activity_type=activity_type,
            run_record_id=run_record_id,
            content=content,
            image_urls=image_urls or [],
            metadata_=metadata,
        )
        db.add(activity)
        await db.flush()
        return activity

    async def auto_create_run_activity(
        self,
        db: AsyncSession,
        user_id: UUID,
        run_record_id: UUID,
    ) -> ActivityFeed:
        """Automatically create a 'run_completed' activity after run completion."""
        run_result = await db.execute(
            select(RunRecord).where(RunRecord.id == run_record_id)
        )
        run_record = run_result.scalar_one_or_none()
        if run_record is None:
            raise NotFoundError(code="NOT_FOUND", message="Run record not found")

        metadata = {
            "distance_meters": run_record.distance_meters,
            "duration_seconds": run_record.duration_seconds,
            "avg_pace_seconds_per_km": run_record.avg_pace_seconds_per_km,
        }
        if run_record.course_id:
            metadata["course_id"] = str(run_record.course_id)

        activity = await self.create_activity(
            db=db,
            user_id=user_id,
            activity_type="run_completed",
            run_record_id=run_record_id,
            metadata=metadata,
        )
        logger.info(
            "[FeedService] Created run_completed activity %s for user %s",
            activity.id, user_id,
        )
        return activity

    async def auto_create_pr_activity(
        self,
        db: AsyncSession,
        user_id: UUID,
        run_record_id: UUID,
        pr_type: str,
        new_value: float | int | None = None,
        prev_value: float | int | None = None,
    ) -> ActivityFeed:
        """Create a 'pr_achieved' activity when a personal record is detected.

        pr_type examples: 'fastest_5k', 'longest_run', 'fastest_10k', etc.
        """
        # Build human-readable labels
        label_map = {
            "fastest_5k": "5K",
            "fastest_10k": "10K",
            "longest_run": "최장 거리",
        }
        distance_label = label_map.get(pr_type, pr_type)

        def format_pace(secs: float | int | None) -> str:
            if secs is None or secs <= 0:
                return ""
            m, s = divmod(int(secs), 60)
            return f"{m}'{s:02d}\""

        def format_dist(meters: float | int | None) -> str:
            if meters is None or meters <= 0:
                return ""
            return f"{meters / 1000:.2f}km"

        if pr_type in ("fastest_5k", "fastest_10k"):
            new_time = format_pace(new_value)
            prev_time = format_pace(prev_value) if prev_value else ""
            improvement = format_pace(prev_value - new_value) if prev_value and new_value else ""
        else:  # longest_run
            new_time = format_dist(new_value)
            prev_time = format_dist(prev_value) if prev_value else ""
            improvement = format_dist(new_value - prev_value) if prev_value and new_value else ""

        metadata = {
            "pr_type": pr_type,
            "run_record_id": str(run_record_id),
            "distance_label": distance_label,
            "new_time": new_time,
            "prev_time": prev_time,
            "improvement": improvement,
        }

        activity = await self.create_activity(
            db=db,
            user_id=user_id,
            activity_type="pr_achieved",
            run_record_id=run_record_id,
            metadata=metadata,
        )
        logger.info(
            "[FeedService] Created pr_achieved (%s) activity %s for user %s",
            pr_type, activity.id, user_id,
        )
        return activity

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    async def get_feed(
        self,
        db: AsyncSession,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
        scope: str = "all",
    ) -> tuple[list[ActivityFeed], int]:
        """Get mixed feed: following activities + recommended activities.

        Strategy: fill each page with following content first, then pad with
        recommended (non-following) content so the feed is never empty.
        """
        # Get IDs of users this user follows
        following_result = await db.execute(
            select(Follow.following_id).where(Follow.follower_id == user_id)
        )
        following_ids = [row.following_id for row in following_result.all()]
        following_ids.append(user_id)  # include own activities

        if scope == "following":
            query = (
                select(ActivityFeed)
                .options(joinedload(ActivityFeed.user))
                .options(joinedload(ActivityFeed.run_record))
                .where(ActivityFeed.user_id.in_(following_ids))
                .order_by(ActivityFeed.created_at.desc())
                .offset(page * per_page)
                .limit(per_page)
            )
            result = await db.execute(query)
            activities = list(result.scalars().unique().all())
            count_result = await db.execute(
                select(func.count(ActivityFeed.id)).where(ActivityFeed.user_id.in_(following_ids))
            )
            return activities, count_result.scalar_one() or 0

        # scope == "all": mixed feed (following + recommended interleave)
        following_query = (
            select(ActivityFeed)
            .options(joinedload(ActivityFeed.user))
            .options(joinedload(ActivityFeed.run_record))
            .where(ActivityFeed.user_id.in_(following_ids))
            .order_by(ActivityFeed.created_at.desc())
            .offset(page * per_page)
            .limit(per_page)
        )
        following_result = await db.execute(following_query)
        following_activities = list(following_result.scalars().unique().all())

        remaining = per_page - len(following_activities)
        recommended_activities: list[ActivityFeed] = []
        if remaining > 0:
            seen_ids = [a.id for a in following_activities]
            private_user_ids = (
                select(User.id).where(
                    User.run_visibility.in_(["private", "followers"])
                )
            )
            run_activity_types = ["run_completed", "pr_achieved"]
            rec_query = (
                select(ActivityFeed)
                .options(joinedload(ActivityFeed.user))
                .options(joinedload(ActivityFeed.run_record))
                .where(
                    ActivityFeed.user_id.notin_(following_ids),
                    ActivityFeed.id.notin_(seen_ids) if seen_ids else True,
                    ~(
                        (ActivityFeed.activity_type.in_(run_activity_types))
                        & (ActivityFeed.user_id.in_(private_user_ids))
                    ),
                )
                .order_by(ActivityFeed.created_at.desc())
                .offset(page * remaining)
                .limit(remaining)
            )
            rec_result = await db.execute(rec_query)
            recommended_activities = list(rec_result.scalars().unique().all())

        merged: list[ActivityFeed] = []
        rec_iter = iter(recommended_activities)
        for i, act in enumerate(following_activities):
            merged.append(act)
            if (i + 1) % 3 == 0:
                rec_item = next(rec_iter, None)
                if rec_item:
                    merged.append(rec_item)
        for rec_item in rec_iter:
            merged.append(rec_item)

        count_result = await db.execute(
            select(func.count(ActivityFeed.id))
        )
        total_count = count_result.scalar_one() or 0

        return merged, total_count

    async def get_user_activities(
        self,
        db: AsyncSession,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
        hide_runs: bool = False,
    ) -> tuple[list[ActivityFeed], int]:
        """Get paginated activities for a single user."""
        run_activity_types = ["run_completed", "pr_achieved"]
        filters = [ActivityFeed.user_id == user_id]
        if hide_runs:
            filters.append(ActivityFeed.activity_type.notin_(run_activity_types))

        count_result = await db.execute(
            select(func.count(ActivityFeed.id)).where(*filters)
        )
        total_count = count_result.scalar_one() or 0

        query = (
            select(ActivityFeed)
            .options(joinedload(ActivityFeed.user))
            .options(joinedload(ActivityFeed.run_record))
            .where(*filters)
            .order_by(ActivityFeed.created_at.desc())
            .offset(page * per_page)
            .limit(per_page)
        )
        result = await db.execute(query)
        activities = result.scalars().unique().all()

        return list(activities), total_count

    async def get_activity_by_id(
        self,
        db: AsyncSession,
        activity_id: UUID,
    ) -> ActivityFeed:
        """Get a single activity by ID, or raise NotFoundError."""
        result = await db.execute(
            select(ActivityFeed).where(ActivityFeed.id == activity_id)
        )
        activity = result.scalar_one_or_none()
        if activity is None:
            raise NotFoundError(code="NOT_FOUND", message="Activity not found")
        return activity

    # ------------------------------------------------------------------
    # Helpers for building response DTOs
    # ------------------------------------------------------------------

    async def get_reactions_summary_batch(
        self,
        db: AsyncSession,
        activity_ids: list[UUID],
        current_user_id: UUID,
    ) -> dict[UUID, dict]:
        """Batch-fetch reaction counts and user's own reactions for activities."""
        if not activity_ids:
            return {}

        # Aggregate counts per activity per type
        counts_result = await db.execute(
            select(
                Reaction.activity_id,
                Reaction.reaction_type,
                func.count(Reaction.id),
            )
            .where(Reaction.activity_id.in_(activity_ids))
            .group_by(Reaction.activity_id, Reaction.reaction_type)
        )

        summary: dict[UUID, dict] = {
            aid: {"counts": {}, "user_reacted": []} for aid in activity_ids
        }
        for activity_id, reaction_type, count in counts_result.all():
            summary[activity_id]["counts"][reaction_type] = count

        # Get current user's reactions
        user_reactions_result = await db.execute(
            select(Reaction.activity_id, Reaction.reaction_type).where(
                Reaction.activity_id.in_(activity_ids),
                Reaction.user_id == current_user_id,
            )
        )
        for activity_id, reaction_type in user_reactions_result.all():
            summary[activity_id]["user_reacted"].append(reaction_type)

        return summary

    # ------------------------------------------------------------------
    # Trending
    # ------------------------------------------------------------------

    async def get_trending(
        self,
        db: AsyncSession,
        hours: int = 48,
        limit: int = 20,
    ) -> list[ActivityFeed]:
        """Get the most-reacted activities in the last N hours.

        Uses a subquery to count reactions per activity within the cutoff
        window, then joins with activities and orders by reaction count.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

        # Subquery: count reactions per activity within the time window
        reaction_counts = (
            select(
                Reaction.activity_id,
                func.count(Reaction.id).label("cnt"),
            )
            .where(Reaction.created_at > cutoff)
            .group_by(Reaction.activity_id)
            .subquery()
        )

        query = (
            select(ActivityFeed)
            .join(
                reaction_counts,
                ActivityFeed.id == reaction_counts.c.activity_id,
            )
            .options(
                joinedload(ActivityFeed.user),
                joinedload(ActivityFeed.run_record),
            )
            .where(ActivityFeed.created_at > cutoff)
            .order_by(reaction_counts.c.cnt.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().unique().all())

    # ------------------------------------------------------------------
    # Weekly Highlights
    # ------------------------------------------------------------------

    async def get_weekly_highlights(
        self,
        db: AsyncSession,
    ) -> dict:
        """Compute community-wide highlights for the current week (Mon-Sun).

        Returns a dict with runner_count, pr_count, total_distance_meters,
        top_activity, and week_start.
        """
        now = datetime.now(timezone.utc)
        # Monday 00:00 of the current week
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )

        # 1. Unique runners this week
        runner_count_result = await db.execute(
            select(func.count(func.distinct(RunRecord.user_id)))
            .where(RunRecord.started_at >= week_start)
        )
        runner_count = runner_count_result.scalar_one() or 0

        # 2. PR count this week
        pr_count_result = await db.execute(
            select(func.count(ActivityFeed.id))
            .where(
                ActivityFeed.activity_type == "pr_achieved",
                ActivityFeed.created_at >= week_start,
            )
        )
        pr_count = pr_count_result.scalar_one() or 0

        # 3. Community total distance this week
        total_distance_result = await db.execute(
            select(func.sum(RunRecord.distance_meters))
            .where(RunRecord.started_at >= week_start)
        )
        total_distance = total_distance_result.scalar_one() or 0

        # 4. Most-reacted activity this week (top 1 trending)
        top_activity = None
        trending = await self.get_trending(
            db=db,
            hours=int((now - week_start).total_seconds() / 3600) or 1,
            limit=1,
        )
        if trending:
            top_activity = trending[0]

        return {
            "runner_count": runner_count,
            "pr_count": pr_count,
            "total_distance_meters": int(total_distance),
            "top_activity": top_activity,
            "week_start": week_start.isoformat(),
        }
