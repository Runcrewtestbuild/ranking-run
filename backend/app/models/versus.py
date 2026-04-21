"""VersusMatch model for 1:1 battle system."""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class VersusMatch(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "versus_matches"
    __table_args__ = (
        Index("idx_versus_challenger", "challenger_id", "status"),
        Index("idx_versus_opponent", "opponent_id", "status"),
        Index("idx_versus_status_end", "status", "end_date"),
    )

    challenger_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # pending | active | completed | declined | cancelled
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )

    # distance | count | pace
    metric: Mapped[str] = mapped_column(String(20), nullable=False)

    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)

    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Accumulated values during the match period
    challenger_value: Mapped[float] = mapped_column(
        Float, default=0.0, server_default="0"
    )
    opponent_value: Mapped[float] = mapped_column(
        Float, default=0.0, server_default="0"
    )

    winner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    challenger: Mapped["User"] = relationship(
        "User", foreign_keys=[challenger_id], lazy="joined"
    )
    opponent: Mapped["User"] = relationship(
        "User", foreign_keys=[opponent_id], lazy="joined"
    )
    winner: Mapped["User | None"] = relationship(
        "User", foreign_keys=[winner_id], lazy="noload"
    )
