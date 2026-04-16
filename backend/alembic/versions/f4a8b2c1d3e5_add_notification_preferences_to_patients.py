"""add notification_preferences to patients

Revision ID: f4a8b2c1d3e5
Revises: dec38a0569fc
Create Date: 2026-04-15 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f4a8b2c1d3e5'
down_revision: Union[str, None] = 'dec38a0569fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('notification_preferences', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('patients', 'notification_preferences')
