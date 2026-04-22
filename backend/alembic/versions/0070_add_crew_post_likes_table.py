"""Add crew_post_likes table for per-user like tracking.

Revision ID: 0070
Revises: 0069
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0070"
down_revision = "0069"


def upgrade() -> None:
    op.create_table(
        "crew_post_likes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("crew_posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "post_id", "user_id", name="uq_crew_post_likes_post_user"
        ),
    )
    op.create_index(
        "idx_crew_post_likes_user", "crew_post_likes", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_crew_post_likes_user", table_name="crew_post_likes")
    op.drop_table("crew_post_likes")
