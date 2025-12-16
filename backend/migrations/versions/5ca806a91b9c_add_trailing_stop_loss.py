"""add_trailing_stop_loss

Revision ID: 5ca806a91b9c
Revises: a1b2c3d4e5f6
Create Date: 2025-12-16 21:53:39.074357

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5ca806a91b9c'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add trailing stop columns to trading_agents table
    op.add_column('trading_agents', sa.Column('trailing_stop_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('trading_agents', sa.Column('trailing_stop_percent', sa.Numeric(precision=4, scale=2), nullable=True, server_default='1.5'))


def downgrade() -> None:
    # Remove trailing stop columns
    op.drop_column('trading_agents', 'trailing_stop_percent')
    op.drop_column('trading_agents', 'trailing_stop_enabled')
