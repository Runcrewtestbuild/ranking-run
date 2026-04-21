"""Add route_thumbnail_url column to run_records for client-uploaded route snapshots.

Revision ID: 0063
Revises: 0062
"""

import sqlalchemy as sa
from alembic import op

revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "run_records",
        sa.Column("route_thumbnail_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("run_records", "route_thumbnail_url")
