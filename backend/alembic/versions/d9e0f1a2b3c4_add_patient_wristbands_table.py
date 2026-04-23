"""add patient_wristbands table

Revision ID: d9e0f1a2b3c4
Revises: c7d8e9f0a1b2
Create Date: 2026-04-22 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d9e0f1a2b3c4"
down_revision: Union[str, None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patient_wristbands",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("wristband_uid", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("barcode", sa.String(100), nullable=True),
        sa.Column("nfc_tag_id", sa.String(100), nullable=True),
        sa.Column("status", sa.Enum("active", "deactivated", "lost", "discharged", name="wristbandstatus"), nullable=True, server_default="active"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issued_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("patient_wristbands")
    op.execute("DROP TYPE IF EXISTS wristbandstatus")
