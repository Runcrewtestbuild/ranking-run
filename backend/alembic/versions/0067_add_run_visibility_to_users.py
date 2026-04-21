"""Add run_visibility column to users table.

Revision ID: 0067
Revises: 0066
"""
from alembic import op
import sqlalchemy as sa

revision = "0067"
down_revision = "0066"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "run_visibility",
            sa.String(20),
            nullable=False,
            server_default="public",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "run_visibility")
