"""Leaderboard schemas: multi-dimensional weekly/course leaderboards."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.ranking import RankingUserInfo


class WeeklyRunnerEntry(BaseModel):
    """A single runner's weekly aggregated stats."""

    rank: int
    user: RankingUserInfo
    total_distance_meters: int
    run_count: int
    total_duration_seconds: int


class WeeklyLeaderboardResponse(BaseModel):
    """Weekly leaderboard with optional user ranking."""

    data: list[WeeklyRunnerEntry]
    my_ranking: WeeklyRunnerEntry | None = None
    period_start: datetime
    period_end: datetime


# -- Multi-dimensional leaderboard entries --

class LeaderboardEntry(BaseModel):
    """Generic leaderboard entry for any dimension."""
    rank: int
    user: RankingUserInfo
    value: float
    label: str | None = None


class LeaderboardResponse(BaseModel):
    """Paginated multi-dimensional leaderboard."""
    board_type: str
    data: list[LeaderboardEntry]
    my_ranking: LeaderboardEntry | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None
    total: int


class CourseRecordEntry(BaseModel):
    """Single course record entry."""
    rank: int
    user: RankingUserInfo
    duration_seconds: int
    pace_seconds_per_km: int
    achieved_at: datetime


class CourseRecordsResponse(BaseModel):
    """Course records leaderboard."""
    course_id: str
    data: list[CourseRecordEntry]
    total: int


class MyRankResponse(BaseModel):
    """User's rank on a specific board with gap to next rank."""
    board_type: str
    rank: int | None
    value: float
    total_participants: int
    gap_to_next: float | None = None
    next_rank_value: float | None = None
