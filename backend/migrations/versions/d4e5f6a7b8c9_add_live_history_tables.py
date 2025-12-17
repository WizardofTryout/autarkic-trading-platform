"""add_live_history_tables

Revision ID: d4e5f6a7b8c9
Revises: c3d5e7f9b1a3
Create Date: 2025-12-17 01:20:00.000000

PURPOSE:
Creates tables for storing LIVE trading history from Bitget:
- live_orders: Order history
- live_trades: Fill/execution history
- financial_records: Ledger entries for tax reporting
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d5e7f9b1a3'  # Points to exchange column migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ========== live_orders table ==========
    op.create_table(
        'live_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        
        # Exchange identifiers
        sa.Column('exchange', sa.String(20), nullable=False, server_default='bitget'),
        sa.Column('exchange_order_id', sa.String(100), nullable=False),
        sa.Column('client_order_id', sa.String(100), nullable=True),
        
        # Order details
        sa.Column('symbol', sa.String(30), nullable=False),
        sa.Column('product_type', sa.String(20), nullable=False, server_default='spot'),
        sa.Column('side', sa.String(10), nullable=False),
        sa.Column('order_type', sa.String(20), nullable=False),
        
        # Pricing
        sa.Column('price', sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column('avg_fill_price', sa.Numeric(precision=20, scale=8), nullable=True),
        
        # Sizing
        sa.Column('size', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('filled_size', sa.Numeric(precision=20, scale=8), nullable=False, server_default='0'),
        
        # Fees
        sa.Column('total_fee', sa.Numeric(precision=20, scale=8), nullable=True),
        sa.Column('fee_currency', sa.String(20), nullable=True),
        
        # Leverage (futures)
        sa.Column('leverage', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('margin_mode', sa.String(20), nullable=True),
        
        # Status
        sa.Column('status', sa.String(20), nullable=False),
        
        # Timestamps
        sa.Column('created_at_exchange', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at_exchange', sa.DateTime(timezone=True), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    # Indexes for live_orders
    op.create_index('idx_live_orders_user', 'live_orders', ['user_id'])
    op.create_index('idx_live_orders_user_symbol', 'live_orders', ['user_id', 'symbol'])
    op.create_index('idx_live_orders_created', 'live_orders', ['user_id', 'created_at_exchange'])
    op.create_unique_constraint('uix_live_order_exchange_id', 'live_orders', ['user_id', 'exchange', 'exchange_order_id'])
    
    # ========== live_trades table ==========
    op.create_table(
        'live_trades',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('live_orders.id', ondelete='CASCADE'), nullable=True),
        
        # Exchange identifiers
        sa.Column('exchange', sa.String(20), nullable=False, server_default='bitget'),
        sa.Column('exchange_trade_id', sa.String(100), nullable=False),
        sa.Column('exchange_order_id', sa.String(100), nullable=False),
        
        # Trade details
        sa.Column('symbol', sa.String(30), nullable=False),
        sa.Column('side', sa.String(10), nullable=False),
        
        # Execution
        sa.Column('price', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('size', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('quote_size', sa.Numeric(precision=20, scale=8), nullable=True),
        
        # Fees
        sa.Column('fee', sa.Numeric(precision=20, scale=8), nullable=False, server_default='0'),
        sa.Column('fee_currency', sa.String(20), nullable=True),
        
        # Role
        sa.Column('role', sa.String(10), nullable=True),
        
        # PnL
        sa.Column('realized_pnl', sa.Numeric(precision=20, scale=8), nullable=True),
        
        # Timestamps
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    # Indexes for live_trades
    op.create_index('idx_live_trades_user', 'live_trades', ['user_id'])
    op.create_index('idx_live_trades_executed', 'live_trades', ['user_id', 'executed_at'])
    op.create_unique_constraint('uix_live_trade_exchange_id', 'live_trades', ['user_id', 'exchange', 'exchange_trade_id'])
    
    # ========== financial_records table ==========
    op.create_table(
        'financial_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        
        # Exchange identifiers
        sa.Column('exchange', sa.String(20), nullable=False, server_default='bitget'),
        sa.Column('record_id', sa.String(100), nullable=False),
        
        # Record type
        sa.Column('record_type', sa.String(50), nullable=False),
        sa.Column('business_type', sa.String(50), nullable=True),
        
        # Amounts
        sa.Column('amount', sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column('currency', sa.String(20), nullable=False),
        sa.Column('balance_after', sa.Numeric(precision=20, scale=8), nullable=True),
        
        # Related entities
        sa.Column('symbol', sa.String(30), nullable=True),
        sa.Column('related_order_id', sa.String(100), nullable=True),
        
        # Notes
        sa.Column('notes', sa.Text, nullable=True),
        
        # Timestamps
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    
    # Indexes for financial_records
    op.create_index('idx_financial_records_user', 'financial_records', ['user_id'])
    op.create_index('idx_financial_records_type', 'financial_records', ['user_id', 'record_type'])
    op.create_index('idx_financial_records_recorded', 'financial_records', ['user_id', 'recorded_at'])
    op.create_unique_constraint('uix_financial_record_id', 'financial_records', ['user_id', 'exchange', 'record_id'])


def downgrade() -> None:
    # Drop financial_records
    op.drop_constraint('uix_financial_record_id', 'financial_records', type_='unique')
    op.drop_index('idx_financial_records_recorded', table_name='financial_records')
    op.drop_index('idx_financial_records_type', table_name='financial_records')
    op.drop_index('idx_financial_records_user', table_name='financial_records')
    op.drop_table('financial_records')
    
    # Drop live_trades
    op.drop_constraint('uix_live_trade_exchange_id', 'live_trades', type_='unique')
    op.drop_index('idx_live_trades_executed', table_name='live_trades')
    op.drop_index('idx_live_trades_user', table_name='live_trades')
    op.drop_table('live_trades')
    
    # Drop live_orders
    op.drop_constraint('uix_live_order_exchange_id', 'live_orders', type_='unique')
    op.drop_index('idx_live_orders_created', table_name='live_orders')
    op.drop_index('idx_live_orders_user_symbol', table_name='live_orders')
    op.drop_index('idx_live_orders_user', table_name='live_orders')
    op.drop_table('live_orders')
