"""Crew feed service: crew-scoped posts, pinning, activity summary."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models.crew import Crew, CrewMember
from app.models.crew_post import CrewPost, CrewPostLike
from app.models.run_record import RunRecord
from app.models.user import User


class CrewFeedService:
    """Handles crew feed posts lifecycle and activity summaries."""

    MAX_PINNED_POSTS = 3

    # ------------------------------------------------------------------
    # Feed queries
    # ------------------------------------------------------------------

    async def get_crew_feed(
        self,
        db: AsyncSession,
        crew_id: UUID,
        user_id: UUID,
        page: int = 0,
        per_page: int = 20,
    ) -> tuple[list[dict], int]:
        """Return paginated crew posts, pinned first then by recency."""
        await self._assert_crew_member(db, crew_id, user_id)

        count_result = await db.execute(
            select(func.count(CrewPost.id)).where(CrewPost.crew_id == crew_id)
        )
        total_count = count_result.scalar_one()

        result = await db.execute(
            select(CrewPost)
            .where(CrewPost.crew_id == crew_id)
            .options(joinedload(CrewPost.author))
            .order_by(
                CrewPost.is_pinned.desc(),
                CrewPost.created_at.desc(),
            )
            .offset(page * per_page)
            .limit(per_page)
        )
        posts = result.scalars().unique().all()

        return [await self._post_to_dict(db, p, viewer_id=user_id) for p in posts], total_count

    # ------------------------------------------------------------------
    # Post CRUD
    # ------------------------------------------------------------------

    async def create_crew_post(
        self,
        db: AsyncSession,
        crew_id: UUID,
        author_id: UUID,
        content: str,
        image_urls: list[str] | None = None,
        post_type: str = "general",
        run_record_id: UUID | None = None,
    ) -> dict:
        member = await self._assert_crew_member(db, crew_id, author_id)

        # Only admin/owner can post notices
        if post_type == "notice" and member.role not in ("owner", "admin"):
            raise PermissionDeniedError(
                code="PERMISSION_DENIED",
                message="공지 작성은 관리자만 가능합니다",
            )

        # Validate run_record if provided
        if run_record_id:
            rr = await db.get(RunRecord, run_record_id)
            if rr is None or rr.user_id != author_id:
                raise BadRequestError(
                    code="INVALID_RUN_RECORD",
                    message="유효하지 않은 런 기록입니다",
                )

        post = CrewPost(
            crew_id=crew_id,
            author_id=author_id,
            content=content,
            image_urls=image_urls,
            post_type=post_type,
            run_record_id=run_record_id,
        )
        db.add(post)

        # Update crew last_activity_at
        crew = await db.get(Crew, crew_id)
        if crew:
            crew.last_activity_at = func.now()

        await db.flush()
        await db.refresh(post)

        return await self._post_to_dict(db, post)

    async def delete_post(
        self,
        db: AsyncSession,
        post_id: UUID,
        user_id: UUID,
    ) -> None:
        post = await self._get_post_or_404(db, post_id)

        # Author can delete their own post; admin/owner can delete any post
        if post.author_id != user_id:
            member = await self._get_membership(db, post.crew_id, user_id)
            if not member or member.role not in ("owner", "admin"):
                raise PermissionDeniedError(
                    code="PERMISSION_DENIED",
                    message="게시글 삭제 권한이 없습니다",
                )

        await db.delete(post)
        await db.flush()

    async def pin_post(
        self,
        db: AsyncSession,
        post_id: UUID,
        user_id: UUID,
        is_pinned: bool,
    ) -> dict:
        post = await self._get_post_or_404(db, post_id)

        member = await self._get_membership(db, post.crew_id, user_id)
        if not member or member.role not in ("owner", "admin"):
            raise PermissionDeniedError(
                code="PERMISSION_DENIED",
                message="게시글 고정은 관리자만 가능합니다",
            )

        if is_pinned:
            # Check max pinned limit
            pinned_count_result = await db.execute(
                select(func.count(CrewPost.id)).where(
                    CrewPost.crew_id == post.crew_id,
                    CrewPost.is_pinned.is_(True),
                    CrewPost.id != post_id,
                )
            )
            pinned_count = pinned_count_result.scalar_one()
            if pinned_count >= self.MAX_PINNED_POSTS:
                raise BadRequestError(
                    code="MAX_PINNED_REACHED",
                    message=f"고정 게시글은 최대 {self.MAX_PINNED_POSTS}개까지 가능합니다",
                )

        post.is_pinned = is_pinned
        await db.flush()
        await db.refresh(post)

        return await self._post_to_dict(db, post)

    # ------------------------------------------------------------------
    # Activity summary
    # ------------------------------------------------------------------

    async def get_crew_activity_summary(
        self,
        db: AsyncSession,
        crew_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Weekly activity summary: total km, active runners, MVP."""
        await self._assert_crew_member(db, crew_id, user_id)

        now = datetime.now(timezone.utc)
        monday = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )

        # Aggregate run data for crew members this week
        result = await db.execute(
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
                and_(
                    RunRecord.user_id == CrewMember.user_id,
                    RunRecord.finished_at >= monday,
                ),
            )
            .where(CrewMember.crew_id == crew_id)
        )
        row = result.one()

        # Find MVP (highest distance this week)
        mvp_result = await db.execute(
            select(
                CrewMember.user_id,
                User.nickname,
                func.coalesce(func.sum(RunRecord.distance_meters), 0).label(
                    "user_distance"
                ),
            )
            .select_from(CrewMember)
            .join(User, User.id == CrewMember.user_id)
            .join(
                RunRecord,
                and_(
                    RunRecord.user_id == CrewMember.user_id,
                    RunRecord.finished_at >= monday,
                ),
            )
            .where(CrewMember.crew_id == crew_id)
            .group_by(CrewMember.user_id, User.nickname)
            .order_by(desc("user_distance"))
            .limit(1)
        )
        mvp = mvp_result.one_or_none()

        return {
            "total_distance_meters": row.total_distance,
            "active_runners": row.active_runners,
            "total_runs": row.total_runs,
            "mvp_user_id": str(mvp.user_id) if mvp else None,
            "mvp_nickname": mvp.nickname if mvp else None,
            "mvp_distance_meters": mvp.user_distance if mvp else 0,
        }

    # ------------------------------------------------------------------
    # Like
    # ------------------------------------------------------------------

    async def toggle_like(
        self,
        db: AsyncSession,
        crew_id: UUID,
        post_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Toggle the like on a crew post for the given user.

        If the user already liked the post, the like is removed and the
        count decremented.  Otherwise a new like is created and the count
        incremented.  Returns the updated post dict with ``is_liked``.
        """
        await self._assert_crew_member(db, crew_id, user_id)
        post = await self._get_post_or_404(db, post_id)

        if post.crew_id != crew_id:
            raise BadRequestError(
                code="POST_NOT_IN_CREW",
                message="해당 크루의 게시글이 아닙니다",
            )

        # Check existing like
        existing = await db.execute(
            select(CrewPostLike).where(
                CrewPostLike.post_id == post_id,
                CrewPostLike.user_id == user_id,
            )
        )
        like_row = existing.scalar_one_or_none()

        if like_row:
            # Unlike
            await db.delete(like_row)
            post.like_count = max(post.like_count - 1, 0)
            is_liked = False
        else:
            # Like
            db.add(CrewPostLike(post_id=post_id, user_id=user_id))
            post.like_count = post.like_count + 1
            is_liked = True

        await db.flush()
        await db.refresh(post)

        return await self._post_to_dict(db, post, viewer_id=user_id, is_liked=is_liked)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_post_or_404(
        self, db: AsyncSession, post_id: UUID
    ) -> CrewPost:
        result = await db.execute(
            select(CrewPost)
            .where(CrewPost.id == post_id)
            .options(joinedload(CrewPost.author))
        )
        post = result.scalar_one_or_none()
        if post is None:
            raise NotFoundError(
                code="POST_NOT_FOUND", message="게시글을 찾을 수 없습니다"
            )
        return post

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
        """Verify user is a crew member; raise if not."""
        # Also verify crew exists
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

    async def _post_to_dict(
        self,
        db: AsyncSession,
        post: CrewPost,
        viewer_id: UUID | None = None,
        is_liked: bool | None = None,
    ) -> dict:
        author = post.author
        run_record_info = None
        if post.run_record_id:
            rr = await db.get(RunRecord, post.run_record_id)
            if rr:
                run_record_info = {
                    "id": str(rr.id),
                    "distance_meters": rr.distance_meters,
                    "duration_seconds": rr.duration_seconds,
                    "pace_seconds_per_km": rr.avg_pace_seconds_per_km,
                }

        # Resolve is_liked: use explicit value if provided, otherwise query
        if is_liked is None and viewer_id is not None:
            like_result = await db.execute(
                select(CrewPostLike.id).where(
                    CrewPostLike.post_id == post.id,
                    CrewPostLike.user_id == viewer_id,
                ).limit(1)
            )
            is_liked = like_result.scalar_one_or_none() is not None

        return {
            "id": str(post.id),
            "crew_id": str(post.crew_id),
            "author": {
                "id": str(author.id) if author else "",
                "nickname": author.nickname if author else None,
                "avatar_url": author.avatar_url if author else None,
            },
            "content": post.content,
            "image_urls": post.image_urls,
            "is_pinned": post.is_pinned,
            "post_type": post.post_type,
            "run_record": run_record_info,
            "like_count": post.like_count,
            "is_liked": is_liked if is_liked is not None else False,
            "comment_count": post.comment_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }
