"""add_ohlcv_cache_table

Revision ID: 875d334249b9
Revises: 5fc8c9fb17c0
Create Date: 2025-12-16 14:21:25.803232

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '875d334249b9'
down_revision = '5fc8c9fb17c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ohlcv_cache table
    op.create_table(
        'ohlcv_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('timeframe', sa.String(10), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('open', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('high', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('low', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('close', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('volume', sa.Numeric(precision=30, scale=8), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Create unique constraint to prevent duplicate candles
    op.create_unique_constraint(
        'uix_ohlcv_symbol_tf_ts',
        'ohlcv_cache',
        ['symbol', 'timeframe', 'timestamp']
    )
    
    # Create indexes for performance
    op.create_index('idx_ohlcv_symbol', 'ohlcv_cache', ['symbol'])
    op.create_index('idx_ohlcv_timeframe', 'ohlcv_cache', ['timeframe'])
    op.create_index('idx_ohlcv_timestamp', 'ohlcv_cache', ['timestamp'], postgresql_using='btree', postgresql_ops={'timestamp': 'DESC'})
    op.create_index('idx_ohlcv_lookup', 'ohlcv_cache', ['symbol', 'timeframe', 'timestamp'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_ohlcv_lookup', table_name='ohlcv_cache')
    op.drop_index('idx_ohlcv_timestamp', table_name='ohlcv_cache')
    op.drop_index('idx_ohlcv_timeframe', table_name='ohlcv_cache')
    op.drop_index('idx_ohlcv_symbol', table_name='ohlcv_cache')
    
    # Drop constraint
    op.drop_constraint('uix_ohlcv_symbol_tf_ts', 'ohlcv_cache', type_='unique')
    
    # Drop table
    op.drop_table('ohlcv_cache')
