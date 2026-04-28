"""FeedComment model for activity feed comments and replies."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class FeedComment(Base, UUIDPrimaryKeyMixin):
    """Comment on an activity feed item. Supports one-level nesting via parent_id."""

    __tablename__ = "feed_comments"
    __table_args__ = (
        Index("idx_feed_comments_activity_created", "activity_id", "created_at"),
        Index("idx_feed_comments_parent", "parent_id"),
    )

    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_feeds.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feed_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reply_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="joined")
    activity: Mapped["ActivityFeed"] = relationship("ActivityFeed", lazy="noload")
    replies: Mapped[list["FeedComment"]] = relationship(
        "FeedComment",
        foreign_keys=[parent_id],
        lazy="noload",
    )
