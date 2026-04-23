"""add predictions table

Revision ID: a3f7c9d2e1b4
Revises: 58187f43e1d0
Create Date: 2026-04-22 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a3f7c9d2e1b4'
down_revision: Union[str, None] = '58187f43e1d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

prediction_type_enum = sa.Enum('bed_occupancy', 'medication_consumption', 'patient_admissions', name='predictiontype')


def upgrade() -> None:
    prediction_type_enum.create(op.get_bind(), checkfirst=True)
    op.create_table('predictions',
        sa.Column('prediction_type', prediction_type_enum, nullable=False),
        sa.Column('target_date', sa.Date(), nullable=False),
        sa.Column('predicted_value', sa.Float(), nullable=False),
        sa.Column('confidence_low', sa.Float(), nullable=True),
        sa.Column('confidence_high', sa.Float(), nullable=True),
        sa.Column('actual_value', sa.Float(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('model_version', sa.String(length=50), nullable=True),
        sa.Column('clinic_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_predictions_clinic_id'), 'predictions', ['clinic_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_predictions_clinic_id'), table_name='predictions')
    op.drop_table('predictions')
    prediction_type_enum.drop(op.get_bind(), checkfirst=True)
