"""add notification_logs table and user telegram_chat_id

Revision ID: a1b2c3d4e5f6
Revises: 7468cd9bb793
Create Date: 2026-04-21 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7468cd9bb793'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification_logs table
    op.create_table(
        'notification_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('clinic_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('channel', sa.Enum('SMS', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'IN_APP', name='notificationchannel'), nullable=False, index=True),
        sa.Column('recipient', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'SENT', 'DELIVERED', 'FAILED', name='notificationstatus'), nullable=False, index=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('related_type', sa.String(100), nullable=True),
        sa.Column('related_id', UUID(as_uuid=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )

    # Add telegram_chat_id to users table
    op.add_column('users', sa.Column('telegram_chat_id', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'telegram_chat_id')
    op.drop_table('notification_logs')
    op.execute("DROP TYPE IF EXISTS notificationchannel")
    op.execute("DROP TYPE IF EXISTS notificationstatus")
