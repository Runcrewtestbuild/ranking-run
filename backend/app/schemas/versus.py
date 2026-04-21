"""Versus match request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.ranking import RankingUserInfo


# -- Requests --

class VersusCreateRequest(BaseModel):
    """Request to create a 1:1 versus match."""
    opponent_id: str
    metric: str = Field(
        ..., pattern="^(distance|count|pace)$",
        description="distance | count | pace",
    )
    duration_days: int = Field(..., ge=1, le=30)


class VersusActionRequest(BaseModel):
    """Placeholder body for accept/decline actions (extensible)."""
    pass


# -- Responses --

class VersusMatchResponse(BaseModel):
    """Single versus match in list/detail responses."""
    id: str
    challenger: RankingUserInfo
    opponent: RankingUserInfo
    status: str
    metric: str
    duration_days: int
    start_date: datetime | None = None
    end_date: datetime | None = None
    challenger_value: float = 0.0
    opponent_value: float = 0.0
    winner_id: str | None = None
    created_at: datetime


class VersusMatchListResponse(BaseModel):
    """List of versus matches."""
    data: list[VersusMatchResponse]
    total: int


class VersusMatchDetailResponse(VersusMatchResponse):
    """Detailed view of a versus match (same fields, reserved for extension)."""
    pass
