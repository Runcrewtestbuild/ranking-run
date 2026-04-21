"""Season and SeasonRanking models for season-based tier system."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Season(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "seasons"
    __table_args__ = (
        Index("idx_seasons_active", "is_active"),
        Index("idx_seasons_dates", "start_date", "end_date"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    # Relationships
    rankings: Mapped[list["SeasonRanking"]] = relationship(
        back_populates="season",
        cascade="all, delete-orphan",
        lazy="noload",
    )


class SeasonRanking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "season_rankings"
    __table_args__ = (
        UniqueConstraint("user_id", "season_id", name="uq_season_ranking_user_season"),
        Index("idx_season_ranking_season_tier", "season_id", "tier", "points"),
        Index("idx_season_ranking_user", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seasons.id", ondelete="CASCADE"),
        nullable=False,
    )

    # bronze | silver | gold | platinum | diamond
    tier: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="bronze"
    )
    points: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="joined")
    season: Mapped["Season"] = relationship(back_populates="rankings")
