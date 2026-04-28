"""Feed comment service: create, list, and delete comments on activity feed items."""

import logging
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.activity_feed import ActivityFeed
from app.models.feed_comment import FeedComment

logger = logging.getLogger(__name__)


class FeedCommentService:
    """Handles CRUD for feed activity comments."""

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_comment(
        self,
        db: AsyncSession,
        activity_id: UUID,
        user_id: UUID,
        content: str,
        parent_id: UUID | None = None,
    ) -> dict:
        """Create a comment (or reply) on an activity.

        Returns a dict with comment fields plus activity_author_id and
        parent_author_id for notification routing.
        """
        # Verify activity exists and get its author
        activity_result = await db.execute(
            select(ActivityFeed.user_id).where(ActivityFeed.id == activity_id)
        )
        activity_author_id = activity_result.scalar_one_or_none()
        if activity_author_id is None:
            raise NotFoundError(code="NOT_FOUND", message="Activity not found")

        parent_author_id: UUID | None = None
        if parent_id:
            parent_result = await db.execute(
                select(FeedComment.user_id).where(
                    FeedComment.id == parent_id,
                    FeedComment.activity_id == activity_id,
                )
            )
            parent_author_id = parent_result.scalar_one_or_none()
            if parent_author_id is None:
                raise NotFoundError(code="NOT_FOUND", message="Parent comment not found")

        comment = FeedComment(
            activity_id=activity_id,
            user_id=user_id,
            parent_id=parent_id,
            content=content,
        )
        db.add(comment)
        await db.flush()

        # Increment parent reply_count
        if parent_id:
            await db.execute(
                update(FeedComment)
                .where(FeedComment.id == parent_id)
                .values(reply_count=FeedComment.reply_count + 1)
            )
            await db.flush()

        # Reload with user join for response
        result = await db.execute(
            select(FeedComment)
            .options(joinedload(FeedComment.user))
            .where(FeedComment.id == comment.id)
        )
        created = result.scalar_one()

        return {
            "id": str(created.id),
            "activity_id": str(created.activity_id),
            "user_id": str(created.user_id),
            "user_nickname": created.user.nickname,
            "user_avatar_url": created.user.avatar_url,
            "parent_id": str(created.parent_id) if created.parent_id else None,
            "content": created.content,
            "reply_count": created.reply_count,
            "created_at": created.created_at,
            "activity_author_id": activity_author_id,
            "parent_author_id": parent_author_id,
        }

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    async def get_comments(
        self,
        db: AsyncSession,
        activity_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> tuple[list[dict], int]:
        """Get top-level comments with first few replies, paginated."""
        # Count top-level comments
        count_result = await db.execute(
            select(func.count()).select_from(FeedComment).where(
                FeedComment.activity_id == activity_id,
                FeedComment.parent_id.is_(None),
            )
        )
        total_count = count_result.scalar_one()

        # Fetch top-level comments
        result = await db.execute(
            select(FeedComment)
            .options(joinedload(FeedComment.user))
            .where(
                FeedComment.activity_id == activity_id,
                FeedComment.parent_id.is_(None),
            )
            .order_by(FeedComment.created_at.asc())
            .offset(page * per_page)
            .limit(per_page)
        )
        comments = result.scalars().unique().all()

        items = []
        for c in comments:
            # Fetch first 3 replies per comment
            replies_result = await db.execute(
                select(FeedComment)
                .options(joinedload(FeedComment.user))
                .where(FeedComment.parent_id == c.id)
                .order_by(FeedComment.created_at.asc())
                .limit(3)
            )
            replies = replies_result.scalars().unique().all()

            items.append({
                "id": str(c.id),
                "activity_id": str(c.activity_id),
                "user_id": str(c.user_id),
                "user_nickname": c.user.nickname,
                "user_avatar_url": c.user.avatar_url,
                "parent_id": None,
                "content": c.content,
                "reply_count": c.reply_count,
                "replies": [
                    {
                        "id": str(r.id),
                        "activity_id": str(r.activity_id),
                        "user_id": str(r.user_id),
                        "user_nickname": r.user.nickname,
                        "user_avatar_url": r.user.avatar_url,
                        "parent_id": str(r.parent_id),
                        "content": r.content,
                        "reply_count": 0,
                        "created_at": r.created_at,
                    }
                    for r in replies
                ],
                "created_at": c.created_at,
            })

        return items, total_count

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_comment(
        self,
        db: AsyncSession,
        comment_id: UUID,
        user_id: UUID,
    ) -> None:
        """Delete a comment (author only)."""
        result = await db.execute(
            select(FeedComment).where(FeedComment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        if comment is None:
            raise NotFoundError(code="NOT_FOUND", message="Comment not found")
        if comment.user_id != user_id:
            raise PermissionDeniedError(
                code="FORBIDDEN", message="Only the author can delete this comment"
            )

        # Decrement parent reply_count if this is a reply
        if comment.parent_id:
            await db.execute(
                update(FeedComment)
                .where(FeedComment.id == comment.parent_id)
                .values(reply_count=func.greatest(FeedComment.reply_count - 1, 0))
            )

        await db.delete(comment)
        await db.flush()
