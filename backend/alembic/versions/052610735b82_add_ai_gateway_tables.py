"""add AI gateway tables

Revision ID: 052610735b82
Revises: f5a6b7c8d9e0
Create Date: 2026-04-28 00:14:20.590717

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '052610735b82'
down_revision: Union[str, None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ai_providers
    op.create_table(
        'ai_providers',
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('base_url', sa.String(length=500), nullable=False),
        sa.Column('api_key_env', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('rate_limit', sa.Integer(), nullable=False),
        sa.Column('requests_today', sa.Integer(), nullable=False),
        sa.Column('reset_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    # ai_prompt_templates
    op.create_table(
        'ai_prompt_templates',
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=False),
        sa.Column('user_prompt_template', sa.Text(), nullable=False),
        sa.Column('model_tier', sa.Enum('fast', 'powerful', name='modeltier'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_prompt_templates_task_type'), 'ai_prompt_templates', ['task_type'], unique=False)

    # ai_usage_log
    op.create_table(
        'ai_usage_log',
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('provider_used', sa.String(length=50), nullable=False),
        sa.Column('model_used', sa.String(length=100), nullable=False),
        sa.Column('input_tokens', sa.Integer(), nullable=False),
        sa.Column('output_tokens', sa.Integer(), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_usage_log_clinic_id'), 'ai_usage_log', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_log_task_type'), 'ai_usage_log', ['task_type'], unique=False)

    # ai_generated_content
    op.create_table(
        'ai_generated_content',
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('input_data', sa.JSON(), nullable=False),
        sa.Column('output_data', sa.JSON(), nullable=False),
        sa.Column('accepted_by_doctor', sa.Boolean(), nullable=True),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['doctor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_generated_content_clinic_id'), 'ai_generated_content', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_ai_generated_content_patient_id'), 'ai_generated_content', ['patient_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_generated_content_patient_id'), table_name='ai_generated_content')
    op.drop_index(op.f('ix_ai_generated_content_clinic_id'), table_name='ai_generated_content')
    op.drop_table('ai_generated_content')
    op.drop_index(op.f('ix_ai_usage_log_task_type'), table_name='ai_usage_log')
    op.drop_index(op.f('ix_ai_usage_log_clinic_id'), table_name='ai_usage_log')
    op.drop_table('ai_usage_log')
    op.drop_index(op.f('ix_ai_prompt_templates_task_type'), table_name='ai_prompt_templates')
    op.drop_table('ai_prompt_templates')
    op.drop_table('ai_providers')
    op.execute("DROP TYPE IF EXISTS modeltier")
