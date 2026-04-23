"""add staff_tasks, staff_messages, patient_changelogs tables

Revision ID: c7d8e9f0a1b2
Revises: b8c4d2e5f7a1
Create Date: 2026-04-22 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "b8c4d2e5f7a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- staff_tasks ---
    op.create_table(
        "staff_tasks",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("todo", "in_progress", "review", "done", name="taskstatus"),
            nullable=True,
            server_default="todo",
        ),
        sa.Column(
            "priority",
            sa.Enum("low", "medium", "high", "urgent", name="taskpriority"),
            nullable=True,
            server_default="medium",
        ),
        sa.Column("assigned_to_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_staff_tasks_clinic_id"), "staff_tasks", ["clinic_id"], unique=False)

    # --- staff_messages ---
    op.create_table(
        "staff_messages",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("channel", sa.String(length=100), nullable=True, server_default="general"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_staff_messages_clinic_id"), "staff_messages", ["clinic_id"], unique=False)

    # --- patient_changelogs ---
    op.create_table(
        "patient_changelogs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("changed_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("changed_by_name", sa.String(length=200), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("changes", sa.JSON(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_patient_changelogs_clinic_id"), "patient_changelogs", ["clinic_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_patient_changelogs_clinic_id"), table_name="patient_changelogs")
    op.drop_table("patient_changelogs")

    op.drop_index(op.f("ix_staff_messages_clinic_id"), table_name="staff_messages")
    op.drop_table("staff_messages")

    op.drop_index(op.f("ix_staff_tasks_clinic_id"), table_name="staff_tasks")
    op.drop_table("staff_tasks")
    op.execute("DROP TYPE IF EXISTS taskstatus")
    op.execute("DROP TYPE IF EXISTS taskpriority")
