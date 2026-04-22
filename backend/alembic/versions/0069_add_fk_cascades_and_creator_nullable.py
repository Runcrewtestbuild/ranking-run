"""Add ondelete cascades to user FKs and make course.creator_id nullable.

Revision ID: 0069
Revises: 0068
"""
from alembic import op
import sqlalchemy as sa

revision = "0069"
down_revision = "0068"


def upgrade() -> None:
    # Make course.creator_id nullable for SET NULL cascade
    op.alter_column("courses", "creator_id", nullable=True)

    # Drop and recreate FKs with ondelete
    for table, col, target, action in [
        ("run_records", "user_id", "users.id", "CASCADE"),
        ("run_sessions", "user_id", "users.id", "CASCADE"),
        ("point_transactions", "user_id", "users.id", "CASCADE"),
        ("reviews", "user_id", "users.id", "CASCADE"),
        ("course_streaks", "user_id", "users.id", "CASCADE"),
        ("courses", "creator_id", "users.id", "SET NULL"),
    ]:
        # Find existing FK name
        fk_name = f"fk_{table}_{col}"
        try:
            op.drop_constraint(fk_name, table, type_="foreignkey")
        except Exception:
            # Constraint name may differ; try convention
            pass
        op.create_foreign_key(fk_name, table, "users", [col], ["id"], ondelete=action)


def downgrade() -> None:
    op.alter_column("courses", "creator_id", nullable=False)
