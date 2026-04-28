"""Feed and Reaction request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared sub-schemas
# ---------------------------------------------------------------------------

class FeedUserInfo(BaseModel):
    """Minimal user info embedded in feed responses."""
    id: str
    nickname: str | None
    avatar_url: str | None


class RunSummary(BaseModel):
    """Condensed run data embedded in activity items."""
    id: str
    distance_meters: int
    duration_seconds: int
    avg_pace_seconds_per_km: int | None = None
    course_title: str | None = None
    route_thumbnail_url: str | None = None


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------

class CreateActivityRequest(BaseModel):
    """Manual post creation (activity_type='post')."""
    content: str | None = Field(None, max_length=2000)
    image_urls: list[str] = Field(default_factory=list, max_length=10)


class ActivityResponse(BaseModel):
    """A single activity item in the feed."""
    id: str
    user: FeedUserInfo
    activity_type: str
    content: str | None = None
    image_urls: list[str] = []
    metadata: dict | None = None
    run_summary: RunSummary | None = None
    reactions_summary: dict[str, int] = {}
    user_reactions: list[str] = []
    comment_count: int = 0
    created_at: datetime


class ActivityFeedPaginatedResponse(BaseModel):
    """Paginated activity feed."""
    data: list[ActivityResponse]
    total_count: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# Reaction
# ---------------------------------------------------------------------------

VALID_REACTION_TYPES = {"clap", "fire", "muscle", "party", "lightning", "heart"}


class AddReactionRequest(BaseModel):
    """Add a reaction to an activity."""
    reaction_type: str = Field(
        ...,
        description="One of: clap, fire, muscle, party, lightning",
    )


class ReactionResponse(BaseModel):
    """Single reaction entry."""
    id: str
    user: FeedUserInfo
    reaction_type: str
    created_at: datetime


class ReactionsAggregateResponse(BaseModel):
    """Aggregated reactions for an activity."""
    activity_id: str
    counts: dict[str, int]
    user_reacted: list[str]


# ---------------------------------------------------------------------------
# Feed Comments
# ---------------------------------------------------------------------------

class CreateFeedCommentRequest(BaseModel):
    """Create a comment on a feed activity."""
    content: str = Field(..., min_length=1, max_length=500)


class FeedCommentResponse(BaseModel):
    """Single comment entry."""
    id: str
    activity_id: str
    user_id: str
    user_nickname: str | None
    user_avatar_url: str | None
    parent_id: str | None = None
    content: str
    replies: list["FeedCommentResponse"] = []
    reply_count: int = 0
    created_at: datetime


class FeedCommentPaginatedResponse(BaseModel):
    """Paginated comment list."""
    data: list[FeedCommentResponse]
    total_count: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# Weekly Highlights
# ---------------------------------------------------------------------------

class WeeklyHighlightsResponse(BaseModel):
    """Community weekly highlights for the Discover tab."""
    runner_count: int = 0
    pr_count: int = 0
    total_distance_meters: int = 0
    top_activity: ActivityResponse | None = None
    week_start: str
