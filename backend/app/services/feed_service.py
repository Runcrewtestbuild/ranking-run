"""Feed service: create and query activity feed items."""

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError
from app.models.activity_feed import ActivityFeed
from app.models.follow import Follow
from app.models.reaction import Reaction
from app.models.run_record import RunRecord

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
    ) -> ActivityFeed:
        """Create a 'pr_achieved' activity when a personal record is detected.

        pr_type examples: 'fastest_5k', 'longest_run', 'fastest_10k', etc.
        """
        metadata = {"pr_type": pr_type, "run_record_id": str(run_record_id)}

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
    ) -> tuple[list[ActivityFeed], int]:
        """Get paginated feed: own activities + activities from followed users."""
        # Get IDs of users this user follows
        following_result = await db.execute(
            select(Follow.following_id).where(Follow.follower_id == user_id)
        )
        following_ids = [row.following_id for row in following_result.all()]
        following_ids.append(user_id)  # include own activities

        # Count
        count_result = await db.execute(
            select(func.count(ActivityFeed.id)).where(
                ActivityFeed.user_id.in_(following_ids)
            )
        )
        total_count = count_result.scalar_one() or 0

        # Fetch
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
        activities = result.scalars().unique().all()

        return list(activities), total_count

    async def get_user_activities(
        self,
        db: AsyncSession,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> tuple[list[ActivityFeed], int]:
        """Get paginated activities for a single user."""
        count_result = await db.execute(
            select(func.count(ActivityFeed.id)).where(
                ActivityFeed.user_id == user_id
            )
        )
        total_count = count_result.scalar_one() or 0

        query = (
            select(ActivityFeed)
            .options(joinedload(ActivityFeed.user))
            .options(joinedload(ActivityFeed.run_record))
            .where(ActivityFeed.user_id == user_id)
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
