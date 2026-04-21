"""add document_templates table

Revision ID: b7c3d8e9f1a2
Revises: de0a6b78e62f
Create Date: 2026-04-21 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'b7c3d8e9f1a2'
down_revision: Union[str, None] = 'de0a6b78e62f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'document_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('clinic_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('category', sa.Enum('prescription', 'discharge', 'referral', 'certificate', 'consent', 'lab_order', 'other', name='templatecategory'), nullable=True, server_default='other'),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('is_system_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_by_id', UUID(as_uuid=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('document_templates')
    op.execute("DROP TYPE IF EXISTS templatecategory")
