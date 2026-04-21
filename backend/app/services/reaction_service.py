"""Reaction service: add, remove, and query reactions on activities."""

import logging
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.activity_feed import ActivityFeed
from app.models.reaction import Reaction
from app.schemas.feed import VALID_REACTION_TYPES

logger = logging.getLogger(__name__)


class ReactionService:
    """Handles adding, removing, and querying reactions on activity feed items."""

    async def add_reaction(
        self,
        db: AsyncSession,
        user_id: UUID,
        activity_id: UUID,
        reaction_type: str,
    ) -> Reaction:
        """Add a reaction to an activity.

        Raises:
            BadRequestError: Invalid reaction type.
            NotFoundError: Activity does not exist.
            ConflictError: User already reacted with this type.
        """
        if reaction_type not in VALID_REACTION_TYPES:
            raise BadRequestError(
                code="INVALID_REACTION",
                message=f"Invalid reaction type. Must be one of: {', '.join(sorted(VALID_REACTION_TYPES))}",
            )

        # Verify activity exists
        activity_result = await db.execute(
            select(ActivityFeed.id).where(ActivityFeed.id == activity_id)
        )
        if activity_result.scalar_one_or_none() is None:
            raise NotFoundError(code="NOT_FOUND", message="Activity not found")

        # Check for duplicate
        existing_result = await db.execute(
            select(Reaction).where(
                Reaction.user_id == user_id,
                Reaction.activity_id == activity_id,
                Reaction.reaction_type == reaction_type,
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            raise ConflictError(
                code="DUPLICATE_REACTION",
                message="You already reacted with this type",
            )

        reaction = Reaction(
            user_id=user_id,
            activity_id=activity_id,
            reaction_type=reaction_type,
        )
        db.add(reaction)
        await db.flush()
        return reaction

    async def remove_reaction(
        self,
        db: AsyncSession,
        user_id: UUID,
        activity_id: UUID,
        reaction_type: str,
    ) -> None:
        """Remove a reaction from an activity.

        Raises:
            NotFoundError: Reaction does not exist.
        """
        result = await db.execute(
            select(Reaction).where(
                Reaction.user_id == user_id,
                Reaction.activity_id == activity_id,
                Reaction.reaction_type == reaction_type,
            )
        )
        reaction = result.scalar_one_or_none()
        if reaction is None:
            raise NotFoundError(code="NOT_FOUND", message="Reaction not found")

        await db.delete(reaction)
        await db.flush()

    async def get_reactions(
        self,
        db: AsyncSession,
        activity_id: UUID,
        current_user_id: UUID,
    ) -> dict:
        """Get aggregated reactions for an activity.

        Returns:
            dict with keys:
                counts: {clap: 5, fire: 3, ...}
                user_reacted: ['clap', 'fire'] (types current user reacted with)
        """
        # Verify activity exists
        activity_result = await db.execute(
            select(ActivityFeed.id).where(ActivityFeed.id == activity_id)
        )
        if activity_result.scalar_one_or_none() is None:
            raise NotFoundError(code="NOT_FOUND", message="Activity not found")

        # Aggregate counts
        counts_result = await db.execute(
            select(Reaction.reaction_type, func.count(Reaction.id))
            .where(Reaction.activity_id == activity_id)
            .group_by(Reaction.reaction_type)
        )
        counts = {rtype: count for rtype, count in counts_result.all()}

        # Current user's reactions
        user_result = await db.execute(
            select(Reaction.reaction_type).where(
                Reaction.activity_id == activity_id,
                Reaction.user_id == current_user_id,
            )
        )
        user_reacted = [row.reaction_type for row in user_result.all()]

        return {
            "counts": counts,
            "user_reacted": user_reacted,
        }
