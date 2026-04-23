"""add nurse_diary_entries and infection_records tables

Revision ID: e2f3a4b5c6d7
Revises: d9e0f1a2b3c4
Create Date: 2026-04-23 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd9e0f1a2b3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'nurse_diary_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('nurse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('shift', sa.String(20), server_default='day'),
        sa.Column('general_condition', sa.String(50), nullable=True),
        sa.Column('consciousness', sa.String(50), nullable=True),
        sa.Column('temperature', sa.String(10), nullable=True),
        sa.Column('blood_pressure', sa.String(20), nullable=True),
        sa.Column('pulse', sa.String(10), nullable=True),
        sa.Column('respiratory_rate', sa.String(10), nullable=True),
        sa.Column('complaints', sa.Text(), nullable=True),
        sa.Column('procedures_done', sa.Text(), nullable=True),
        sa.Column('medications_given', sa.JSON(), nullable=True),
        sa.Column('diet', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create isolation_type and infection_status enums
    isolation_type_enum = postgresql.ENUM('contact', 'droplet', 'airborne', 'protective', name='isolationtype', create_type=False)
    infection_status_enum = postgresql.ENUM('suspected', 'confirmed', 'resolved', 'monitoring', name='infectionstatus', create_type=False)
    isolation_type_enum.create(op.get_bind(), checkfirst=True)
    infection_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'infection_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('reported_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('infection_type', sa.String(200), nullable=False),
        sa.Column('isolation_type', isolation_type_enum, server_default='contact'),
        sa.Column('status', infection_status_enum, server_default='suspected'),
        sa.Column('detected_date', sa.Date(), nullable=False),
        sa.Column('resolved_date', sa.Date(), nullable=True),
        sa.Column('room_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_quarantined', sa.Boolean(), server_default='false'),
        sa.Column('precautions', sa.Text(), nullable=True),
        sa.Column('contact_trace', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('infection_records')
    op.drop_table('nurse_diary_entries')
    op.execute("DROP TYPE IF EXISTS infectionstatus")
    op.execute("DROP TYPE IF EXISTS isolationtype")
