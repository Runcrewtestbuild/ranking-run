"""Add versus_matches, seasons, and season_rankings tables for Phase 2.

Revision ID: 0065
Revises: 0064
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- versus_matches --
    op.create_table(
        "versus_matches",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("challenger_id", UUID(as_uuid=True), nullable=False),
        sa.Column("opponent_id", UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("metric", sa.String(20), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("challenger_value", sa.Float(), server_default="0", nullable=False),
        sa.Column("opponent_value", sa.Float(), server_default="0", nullable=False),
        sa.Column("winner_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["challenger_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opponent_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["winner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_versus_challenger", "versus_matches", ["challenger_id", "status"])
    op.create_index("idx_versus_opponent", "versus_matches", ["opponent_id", "status"])
    op.create_index("idx_versus_status_end", "versus_matches", ["status", "end_date"])

    # -- seasons --
    op.create_table(
        "seasons",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_seasons_active", "seasons", ["is_active"])
    op.create_index("idx_seasons_dates", "seasons", ["start_date", "end_date"])

    # -- season_rankings --
    op.create_table(
        "season_rankings",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("season_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(20), server_default="bronze", nullable=False),
        sa.Column("points", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "season_id", name="uq_season_ranking_user_season"),
    )
    op.create_index("idx_season_ranking_season_tier", "season_rankings", ["season_id", "tier", "points"])
    op.create_index("idx_season_ranking_user", "season_rankings", ["user_id"])


def downgrade() -> None:
    op.drop_table("season_rankings")
    op.drop_table("seasons")
    op.drop_table("versus_matches")
