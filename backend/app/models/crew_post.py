"""CrewPost and CrewPostLike models for crew-scoped feed posts."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CrewPost(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A post within a crew feed.

    post_type:
        - general: free-form crew discussion
        - notice: crew admin announcements (pinnable)
        - run_share: auto-generated when a member shares a run record
    """

    __tablename__ = "crew_posts"
    __table_args__ = (
        Index("idx_crew_posts_crew_created", "crew_id", "created_at"),
        Index("idx_crew_posts_crew_pinned", "crew_id", "is_pinned"),
        Index("idx_crew_posts_author", "author_id"),
    )

    crew_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crews.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_urls: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    post_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="general"
    )
    run_record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("run_records.id", ondelete="SET NULL"),
        nullable=True,
    )
    like_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    comment_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )

    # Relationships
    author: Mapped["User"] = relationship("User", lazy="joined")
    crew: Mapped["Crew"] = relationship("Crew", lazy="noload")
    run_record: Mapped["RunRecord | None"] = relationship(
        "RunRecord", lazy="noload"
    )
    likes: Mapped[list["CrewPostLike"]] = relationship(
        "CrewPostLike", back_populates="post", cascade="all, delete-orphan"
    )


class CrewPostLike(Base):
    """Tracks per-user likes on crew posts for idempotent toggle."""

    __tablename__ = "crew_post_likes"
    __table_args__ = (
        UniqueConstraint(
            "post_id", "user_id", name="uq_crew_post_likes_post_user"
        ),
        Index("idx_crew_post_likes_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crew_posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    post: Mapped["CrewPost"] = relationship(
        "CrewPost", back_populates="likes"
    )
