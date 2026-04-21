"""ScheduledRun and ScheduledRunParticipant models for crew group run scheduling."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ScheduledRun(Base, UUIDPrimaryKeyMixin):
    """A scheduled group run organized within a crew.

    status lifecycle: upcoming -> in_progress -> completed
                      upcoming -> cancelled
    """

    __tablename__ = "scheduled_runs"
    __table_args__ = (
        Index("idx_scheduled_runs_crew_scheduled", "crew_id", "scheduled_at"),
        Index("idx_scheduled_runs_organizer", "organizer_id"),
        Index("idx_scheduled_runs_status", "status"),
    )

    crew_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crews.id", ondelete="CASCADE"),
        nullable=False,
    )
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    location_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    location_lat: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    location_lng: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    estimated_distance_meters: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    estimated_pace: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    max_participants: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    participant_count: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="upcoming"
    )
    is_open: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    organizer: Mapped["User"] = relationship("User", lazy="joined")
    crew: Mapped["Crew"] = relationship("Crew", lazy="noload")
    participants: Mapped[list["ScheduledRunParticipant"]] = relationship(
        back_populates="scheduled_run",
        cascade="all, delete-orphan",
        lazy="noload",
    )


class ScheduledRunParticipant(Base, UUIDPrimaryKeyMixin):
    """RSVP record for a scheduled run.

    status: going / maybe / declined
    """

    __tablename__ = "scheduled_run_participants"
    __table_args__ = (
        UniqueConstraint(
            "scheduled_run_id", "user_id", name="uq_scheduled_run_participant"
        ),
        Index("idx_scheduled_run_participants_user", "user_id"),
    )

    scheduled_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scheduled_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="going"
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    scheduled_run: Mapped["ScheduledRun"] = relationship(
        back_populates="participants"
    )
    user: Mapped["User"] = relationship("User", lazy="joined")
