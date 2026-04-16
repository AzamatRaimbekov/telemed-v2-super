"""add medical_history_entries and room_assignments tables

Revision ID: a1b2c3d4e5f6
Revises: e0d0a67c9998
Create Date: 2026-04-09 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e0d0a67c9998'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('medical_history_entries',
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('hospitalization_id', sa.UUID(), nullable=True),
        sa.Column('entry_type', sa.Enum('initial_exam', 'daily_note', 'specialist_consult', 'procedure_note', 'discharge_summary', 'anamnesis', 'surgery_note', 'lab_interpretation', 'imaging_description', 'ai_generated', 'manual', name='historyentrytype'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('author_id', sa.UUID(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True),
        sa.Column('source_type', sa.Enum('manual', 'ai_from_photo', 'ai_from_audio', 'ai_generated', name='sourcetype'), nullable=True),
        sa.Column('source_document_url', sa.String(length=500), nullable=True),
        sa.Column('ai_confidence', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('linked_diagnosis_id', sa.UUID(), nullable=True),
        sa.Column('linked_lab_id', sa.UUID(), nullable=True),
        sa.Column('linked_procedure_id', sa.UUID(), nullable=True),
        sa.Column('clinic_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_medical_history_entries_patient_id'), 'medical_history_entries', ['patient_id'], unique=False)
    op.create_index(op.f('ix_medical_history_entries_clinic_id'), 'medical_history_entries', ['clinic_id'], unique=False)

    op.create_table('room_assignments',
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('hospitalization_id', sa.UUID(), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=False),
        sa.Column('room_id', sa.UUID(), nullable=False),
        sa.Column('bed_id', sa.UUID(), nullable=False),
        sa.Column('placement_type', sa.Enum('emergency_room', 'icu', 'ward', 'day_hospital', 'isolation', 'operating_room', name='placementtype'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('transfer_reason', sa.String(length=200), nullable=True),
        sa.Column('transferred_by', sa.UUID(), nullable=True),
        sa.Column('condition_on_transfer', sa.Enum('stable', 'improved', 'deteriorated', 'critical', name='transfercondition'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('clinic_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['bed_id'], ['beds.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id']),
        sa.ForeignKeyConstraint(['transferred_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_room_assignments_patient_id'), 'room_assignments', ['patient_id'], unique=False)
    op.create_index(op.f('ix_room_assignments_clinic_id'), 'room_assignments', ['clinic_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_room_assignments_clinic_id'), table_name='room_assignments')
    op.drop_index(op.f('ix_room_assignments_patient_id'), table_name='room_assignments')
    op.drop_table('room_assignments')
    op.drop_index(op.f('ix_medical_history_entries_clinic_id'), table_name='medical_history_entries')
    op.drop_index(op.f('ix_medical_history_entries_patient_id'), table_name='medical_history_entries')
    op.drop_table('medical_history_entries')
    op.execute("DROP TYPE IF EXISTS historyentrytype")
    op.execute("DROP TYPE IF EXISTS sourcetype")
    op.execute("DROP TYPE IF EXISTS placementtype")
    op.execute("DROP TYPE IF EXISTS transfercondition")
