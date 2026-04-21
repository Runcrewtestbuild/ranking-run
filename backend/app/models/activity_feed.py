"""Activity Feed model for social activity tracking."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ActivityFeed(Base, UUIDPrimaryKeyMixin):
    """Tracks user activities for the social feed.

    activity_type values:
        - run_completed: user finished a run
        - pr_achieved: personal record broken
        - challenge_completed: challenge finished
        - crew_joined: user joined a crew
        - streak_milestone: consecutive run streak milestone
        - post: manual user post
    """

    __tablename__ = "activity_feeds"
    __table_args__ = (
        Index("idx_activity_feeds_user_created", "user_id", "created_at"),
        Index("idx_activity_feeds_created_at", "created_at"),
        Index("idx_activity_feeds_type", "activity_type"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    activity_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    run_record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("run_records.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    image_urls: Mapped[list | None] = mapped_column(
        JSONB,
        server_default="[]",
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="joined")
    run_record: Mapped["RunRecord | None"] = relationship("RunRecord", lazy="joined")
    reactions: Mapped[list["Reaction"]] = relationship(
        "Reaction",
        back_populates="activity",
        cascade="all, delete-orphan",
        lazy="noload",
    )
