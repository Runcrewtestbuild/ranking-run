"""Crew feed request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---- Request schemas ----


class CrewPostCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    image_urls: list[str] | None = Field(None, max_length=10)
    post_type: str = Field("general", pattern="^(general|notice|run_share)$")
    run_record_id: UUID | None = None


class CrewPostPinRequest(BaseModel):
    is_pinned: bool


# ---- Response schemas ----


class CrewPostAuthor(BaseModel):
    id: str
    nickname: str | None = None
    avatar_url: str | None = None


class CrewPostRunRecord(BaseModel):
    id: str
    distance_meters: int | None = None
    duration_seconds: int | None = None
    pace_seconds_per_km: int | None = None


class CrewPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    crew_id: str
    author: CrewPostAuthor
    content: str
    image_urls: list[str] | None = None
    is_pinned: bool = False
    post_type: str = "general"
    run_record: CrewPostRunRecord | None = None
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class CrewPostListResponse(BaseModel):
    data: list[CrewPostResponse]
    total_count: int


class CrewActivitySummary(BaseModel):
    total_distance_meters: int
    active_runners: int
    total_runs: int
    mvp_user_id: str | None = None
    mvp_nickname: str | None = None
    mvp_distance_meters: int = 0
