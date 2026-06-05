"""Drop friend_requests table — friend system removed entirely.

Revision ID: 0072
Revises: 0071
"""
from alembic import op

revision = "0072"
down_revision = "0071"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("idx_friend_requests_requester", table_name="friend_requests")
    op.drop_index("idx_friend_requests_recipient_status", table_name="friend_requests")
    op.drop_table("friend_requests")


def downgrade() -> None:
    import sqlalchemy as sa
    from sqlalchemy.dialects.postgresql import UUID

    op.create_table(
        "friend_requests",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "requester_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "requester_id", "recipient_id", name="uq_friend_request_pair"
        ),
        sa.CheckConstraint(
            "requester_id != recipient_id", name="ck_no_self_friend_request"
        ),
    )
    op.create_index(
        "idx_friend_requests_recipient_status",
        "friend_requests",
        ["recipient_id", "status"],
    )
    op.create_index(
        "idx_friend_requests_requester",
        "friend_requests",
        ["requester_id"],
    )
