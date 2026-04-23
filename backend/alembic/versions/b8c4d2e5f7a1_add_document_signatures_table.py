"""add document_signatures table

Revision ID: b8c4d2e5f7a1
Revises: f619606393be
Create Date: 2026-04-22 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b8c4d2e5f7a1"
down_revision: Union[str, None] = "f619606393be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_signatures",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("document_title", sa.String(length=300), nullable=False),
        sa.Column("signer_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signer_name", sa.String(length=200), nullable=False),
        sa.Column("signer_role", sa.String(length=50), nullable=False),
        sa.Column("signature_hash", sa.String(length=500), nullable=True),
        sa.Column("pin_code_verified", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column(
            "status",
            sa.Enum("pending", "signed", "rejected", "expired", name="signaturestatus"),
            nullable=True,
            server_default="pending",
        ),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.ForeignKeyConstraint(["signer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_document_signatures_clinic_id"),
        "document_signatures",
        ["clinic_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_document_signatures_clinic_id"),
        table_name="document_signatures",
    )
    op.drop_table("document_signatures")
    op.execute("DROP TYPE IF EXISTS signaturestatus")
