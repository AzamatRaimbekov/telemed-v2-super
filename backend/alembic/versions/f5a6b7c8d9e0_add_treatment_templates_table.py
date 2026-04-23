"""add treatment_templates table

Revision ID: f5a6b7c8d9e0
Revises: e2f3a4b5c6d7
Create Date: 2026-04-23 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'treatment_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('clinic_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('icd10_code', sa.String(20), nullable=False, index=True),
        sa.Column('icd10_name', sa.String(300), nullable=False),
        sa.Column('template_name', sa.String(200), nullable=False),
        sa.Column('medications', sa.JSON(), nullable=True),
        sa.Column('procedures', sa.JSON(), nullable=True),
        sa.Column('recommendations', sa.Text(), nullable=True),
        sa.Column('diet', sa.String(200), nullable=True),
        sa.Column('created_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('treatment_templates')
