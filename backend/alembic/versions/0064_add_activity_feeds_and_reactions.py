"""Add activity_feeds and reactions tables for social activity feed.

Revision ID: 0064
Revises: 0063
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0064"
down_revision = "0063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- activity_feeds ---
    op.create_table(
        "activity_feeds",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity_type", sa.String(30), nullable=False),
        sa.Column("run_record_id", UUID(as_uuid=True), sa.ForeignKey("run_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("image_urls", JSONB, server_default="[]"),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("idx_activity_feeds_user_created", "activity_feeds", ["user_id", "created_at"])
    op.create_index("idx_activity_feeds_created_at", "activity_feeds", ["created_at"])
    op.create_index("idx_activity_feeds_type", "activity_feeds", ["activity_type"])

    # --- reactions ---
    op.create_table(
        "reactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("activity_id", UUID(as_uuid=True), sa.ForeignKey("activity_feeds.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reaction_type", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_unique_constraint(
        "uq_reaction_user_activity_type",
        "reactions",
        ["user_id", "activity_id", "reaction_type"],
    )


def downgrade() -> None:
    op.drop_table("reactions")
    op.drop_table("activity_feeds")
