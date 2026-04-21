"""Reaction model for activity feed reactions."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class Reaction(Base, UUIDPrimaryKeyMixin):
    """Stores emoji-style reactions on activity feed items.

    reaction_type values: 'clap', 'fire', 'muscle', 'party', 'lightning'
    Each user can only react once per type per activity.
    """

    __tablename__ = "reactions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "activity_id", "reaction_type",
            name="uq_reaction_user_activity_type",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_feeds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reaction_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="joined")
    activity: Mapped["ActivityFeed"] = relationship(
        "ActivityFeed",
        back_populates="reactions",
        lazy="noload",
    )
