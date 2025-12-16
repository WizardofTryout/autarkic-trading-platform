"""add_leverage_and_margin_mode_to_trading_agents

Revision ID: a1b2c3d4e5f6
Revises: 875d334249b9
Create Date: 2025-12-16 20:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '875d334249b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add leverage column to trading_agents table
    op.add_column('trading_agents', sa.Column('leverage', sa.Integer(), nullable=False, server_default='10'))
    
    # Add margin_mode column to trading_agents table
    op.add_column('trading_agents', sa.Column('margin_mode', sa.String(10), nullable=False, server_default='ISOLATED'))


def downgrade() -> None:
    # Remove leverage and margin_mode columns from trading_agents table
    op.drop_column('trading_agents', 'margin_mode')
    op.drop_column('trading_agents', 'leverage')
