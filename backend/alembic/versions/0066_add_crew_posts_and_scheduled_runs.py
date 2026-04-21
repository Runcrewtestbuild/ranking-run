"""Add crew_posts and scheduled_runs tables for crew feed and group run scheduler.

Revision ID: 0066
Revises: 0065
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- crew_posts ---
    op.create_table(
        "crew_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crew_id", UUID(as_uuid=True), sa.ForeignKey("crews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("image_urls", JSONB, nullable=True),
        sa.Column("is_pinned", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("post_type", sa.String(20), nullable=False, server_default="general"),
        sa.Column("run_record_id", UUID(as_uuid=True), sa.ForeignKey("run_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("like_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("idx_crew_posts_crew_created", "crew_posts", ["crew_id", "created_at"])
    op.create_index("idx_crew_posts_crew_pinned", "crew_posts", ["crew_id", "is_pinned"])
    op.create_index("idx_crew_posts_author", "crew_posts", ["author_id"])

    # --- scheduled_runs ---
    op.create_table(
        "scheduled_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crew_id", UUID(as_uuid=True), sa.ForeignKey("crews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organizer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("location_lat", sa.Float, nullable=True),
        sa.Column("location_lng", sa.Float, nullable=True),
        sa.Column("estimated_distance_meters", sa.Integer, nullable=True),
        sa.Column("estimated_pace", sa.String(20), nullable=True),
        sa.Column("max_participants", sa.Integer, nullable=True),
        sa.Column("participant_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="upcoming"),
        sa.Column("is_open", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("idx_scheduled_runs_crew_scheduled", "scheduled_runs", ["crew_id", "scheduled_at"])
    op.create_index("idx_scheduled_runs_organizer", "scheduled_runs", ["organizer_id"])
    op.create_index("idx_scheduled_runs_status", "scheduled_runs", ["status"])

    # --- scheduled_run_participants ---
    op.create_table(
        "scheduled_run_participants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("scheduled_run_id", UUID(as_uuid=True), sa.ForeignKey("scheduled_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="going"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_unique_constraint(
        "uq_scheduled_run_participant",
        "scheduled_run_participants",
        ["scheduled_run_id", "user_id"],
    )
    op.create_index("idx_scheduled_run_participants_user", "scheduled_run_participants", ["user_id"])


def downgrade() -> None:
    op.drop_table("scheduled_run_participants")
    op.drop_table("scheduled_runs")
    op.drop_table("crew_posts")
