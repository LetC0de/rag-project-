"""add conversations table

Revision ID: a1b2c3d4e5f6
Revises: eed3c7786034
Create Date: 2026-08-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'eed3c7786034'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the conversations table for chat-session metadata.

    Note: chat message state is checkpointed separately by LangGraph's
    PostgresSaver (its own tables). This table is application-level metadata
    only — title, ownership, timestamps.
    """
    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False, server_default='New Chat'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_conversations_user_id_users'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_conversations_user_id',
        'conversations',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    """Drop the conversations table."""
    op.drop_index('ix_conversations_user_id', table_name='conversations')
    op.drop_table('conversations')