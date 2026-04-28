"""Add feed_comments table for activity feed commenting.

Revision ID: 0071
Revises: 0070
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0071"
down_revision = "0070"


def upgrade() -> None:
    op.create_table(
        "feed_comments",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("activity_id", UUID(as_uuid=True), sa.ForeignKey("activity_feeds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("feed_comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("reply_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_feed_comments_activity_created", "feed_comments", ["activity_id", "created_at"])
    op.create_index("idx_feed_comments_parent", "feed_comments", ["parent_id"])


def downgrade() -> None:
    op.drop_index("idx_feed_comments_parent", table_name="feed_comments")
    op.drop_index("idx_feed_comments_activity_created", table_name="feed_comments")
    op.drop_table("feed_comments")
