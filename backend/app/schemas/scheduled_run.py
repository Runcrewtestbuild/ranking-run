"""Scheduled run (crew group run) request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---- Request schemas ----


class ScheduledRunCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)
    scheduled_at: datetime
    location_name: str | None = Field(None, max_length=200)
    location_lat: float | None = Field(None, ge=-90, le=90)
    location_lng: float | None = Field(None, ge=-180, le=180)
    estimated_distance_meters: int | None = Field(None, ge=0)
    estimated_pace: str | None = Field(None, max_length=20)
    max_participants: int | None = Field(None, ge=2, le=500)
    is_open: bool = False


class ScheduledRunUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)
    scheduled_at: datetime | None = None
    location_name: str | None = Field(None, max_length=200)
    location_lat: float | None = Field(None, ge=-90, le=90)
    location_lng: float | None = Field(None, ge=-180, le=180)
    estimated_distance_meters: int | None = Field(None, ge=0)
    estimated_pace: str | None = Field(None, max_length=20)
    max_participants: int | None = Field(None, ge=2, le=500)
    is_open: bool | None = None


class RSVPRequest(BaseModel):
    status: str = Field(..., pattern="^(going|maybe|declined)$")


# ---- Response schemas ----


class ScheduledRunOrganizerInfo(BaseModel):
    id: str
    nickname: str | None = None
    avatar_url: str | None = None


class ScheduledRunParticipantInfo(BaseModel):
    user_id: str
    nickname: str | None = None
    avatar_url: str | None = None
    status: str
    joined_at: datetime


class ScheduledRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    crew_id: str
    organizer: ScheduledRunOrganizerInfo
    title: str
    description: str | None = None
    scheduled_at: datetime
    location_name: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    estimated_distance_meters: int | None = None
    estimated_pace: str | None = None
    max_participants: int | None = None
    participant_count: int = 0
    status: str
    is_open: bool = False
    my_rsvp: str | None = None
    participants: list[ScheduledRunParticipantInfo] = []
    created_at: datetime


class ScheduledRunListResponse(BaseModel):
    data: list[ScheduledRunResponse]
    total_count: int


# ---- Crew vs Crew ranking schemas ----


class CrewWeeklyRankingEntry(BaseModel):
    rank: int
    crew_id: str
    crew_name: str
    crew_logo_url: str | None = None
    crew_badge_color: str | None = None
    member_count: int
    total_distance_meters: int
    active_runners: int
    avg_pace_seconds_per_km: int | None = None


class CrewWeeklyRankingListResponse(BaseModel):
    data: list[CrewWeeklyRankingEntry]
    total_count: int
    my_crew: CrewWeeklyRankingEntry | None = None


class CrewDetailStats(BaseModel):
    crew_id: str
    crew_name: str
    total_distance_meters: int
    active_runners: int
    total_runs: int
    avg_pace_seconds_per_km: int | None = None
    weekly_distance_meters: int
    weekly_runs: int
