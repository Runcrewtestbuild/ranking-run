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

    # Drop and recreate FKs with ondelete using actual constraint names
    fk_changes = [
        ("run_records", "run_records_user_id_fkey", "user_id", "users", "id", "CASCADE"),
        ("run_sessions", "run_sessions_user_id_fkey", "user_id", "users", "id", "CASCADE"),
        ("point_transactions", "point_transactions_user_id_fkey", "user_id", "users", "id", "CASCADE"),
        ("reviews", "reviews_user_id_fkey", "user_id", "users", "id", "CASCADE"),
        ("course_streaks", "course_streaks_user_id_fkey", "user_id", "users", "id", "CASCADE"),
        ("courses", "courses_creator_id_fkey", "creator_id", "users", "id", "SET NULL"),
    ]

    for table, fk_name, col, ref_table, ref_col, action in fk_changes:
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, ref_table, [col], [ref_col], ondelete=action)


def downgrade() -> None:
    op.alter_column("courses", "creator_id", nullable=False)
    # Restore original FKs without ondelete
    fk_changes = [
        ("run_records", "run_records_user_id_fkey", "user_id", "users", "id"),
        ("run_sessions", "run_sessions_user_id_fkey", "user_id", "users", "id"),
        ("point_transactions", "point_transactions_user_id_fkey", "user_id", "users", "id"),
        ("reviews", "reviews_user_id_fkey", "user_id", "users", "id"),
        ("course_streaks", "course_streaks_user_id_fkey", "user_id", "users", "id"),
        ("courses", "courses_creator_id_fkey", "creator_id", "users", "id"),
    ]
    for table, fk_name, col, ref_table, ref_col in fk_changes:
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, ref_table, [col], [ref_col])
