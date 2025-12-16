"""add_exchange_column_to_ohlcv_cache

Revision ID: c3d5e7f9b1a3
Revises: a1b2c3d4e5f6
Create Date: 2025-12-17 00:35:00.000000

PURPOSE:
Enables dual-stream data storage for arbitrage/comparison analysis.
- Binance data: exchange='binance'
- Bitget data: exchange='bitget'

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d5e7f9b1a3'
down_revision = '5ca806a91b9c'  # Latest actual head
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add 'exchange' column with default value
    op.add_column(
        'ohlcv_cache',
        sa.Column('exchange', sa.String(20), nullable=False, server_default='binance')
    )
    
    # Step 2: Drop old unique constraint (symbol, timeframe, timestamp)
    op.drop_constraint('uix_ohlcv_symbol_tf_ts', 'ohlcv_cache', type_='unique')
    
    # Step 3: Create new unique constraint including exchange
    op.create_unique_constraint(
        'uix_ohlcv_exchange_symbol_tf_ts',
        'ohlcv_cache',
        ['exchange', 'symbol', 'timeframe', 'timestamp']
    )
    
    # Step 4: Update lookup index to include exchange
    op.drop_index('idx_ohlcv_lookup', table_name='ohlcv_cache')
    op.create_index(
        'idx_ohlcv_lookup', 
        'ohlcv_cache', 
        ['exchange', 'symbol', 'timeframe', 'timestamp']
    )
    
    # Step 5: Create index for exchange filtering
    op.create_index('idx_ohlcv_exchange', 'ohlcv_cache', ['exchange'])


def downgrade() -> None:
    # Revert: Drop new index
    op.drop_index('idx_ohlcv_exchange', table_name='ohlcv_cache')
    
    # Revert: Restore old lookup index
    op.drop_index('idx_ohlcv_lookup', table_name='ohlcv_cache')
    op.create_index('idx_ohlcv_lookup', 'ohlcv_cache', ['symbol', 'timeframe', 'timestamp'])
    
    # Revert: Drop new constraint
    op.drop_constraint('uix_ohlcv_exchange_symbol_tf_ts', 'ohlcv_cache', type_='unique')
    
    # Revert: Restore old constraint
    op.create_unique_constraint(
        'uix_ohlcv_symbol_tf_ts',
        'ohlcv_cache',
        ['symbol', 'timeframe', 'timestamp']
    )
    
    # Revert: Drop exchange column
    op.drop_column('ohlcv_cache', 'exchange')
