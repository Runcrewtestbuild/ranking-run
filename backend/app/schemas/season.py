"""Season and season-ranking request/response schemas."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.ranking import RankingUserInfo


class SeasonResponse(BaseModel):
    """Season summary."""
    id: str
    name: str
    start_date: datetime
    end_date: datetime
    is_active: bool


class SeasonRankingEntry(BaseModel):
    """Single entry in a season leaderboard."""
    rank: int
    user: RankingUserInfo
    tier: str
    points: int


class SeasonRankingResponse(BaseModel):
    """User's season ranking info."""
    season: SeasonResponse
    tier: str
    points: int
    rank: int | None
    next_tier: str | None = None
    points_to_next_tier: int | None = None


class SeasonLeaderboardResponse(BaseModel):
    """Paginated season leaderboard."""
    data: list[SeasonRankingEntry]
    my_ranking: SeasonRankingEntry | None = None
    season: SeasonResponse
    total: int
