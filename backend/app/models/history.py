"""
Live Trading History Models.

Stores order history, trade fills, and financial records
from the Bitget exchange for:
- Trade history analysis
- Tax reporting (CSV export)
- Account reconciliation

IMPORTANT: These tables are SEPARATE from Paper Trading.
- Paper Trading: PaperOrder, PaperTrade, PaperPosition
- Live Trading: LiveOrder, LiveTrade, FinancialRecord
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Enum, Text, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

# Import Base from the models module where it's defined
from app.models.base import Base


class LiveOrder(Base):
    """
    Orders placed on Bitget exchange.
    
    Synced from Bitget API: /api/v2/spot/trade/history-orders
    or /api/v2/mix/order/history
    """
    __tablename__ = "live_orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Exchange identifiers
    exchange = Column(String(20), nullable=False, default='bitget')  # For future multi-exchange support
    exchange_order_id = Column(String(100), nullable=False)  # Bitget's orderId
    client_order_id = Column(String(100), nullable=True)  # clientOId if set
    
    # Order details
    symbol = Column(String(30), nullable=False)  # e.g., "BTCUSDT"
    product_type = Column(String(20), nullable=False, default='spot')  # spot, usdt-futures, coin-futures
    side = Column(String(10), nullable=False)  # buy, sell
    order_type = Column(String(20), nullable=False)  # limit, market
    
    # Pricing
    price = Column(Numeric(precision=20, scale=8), nullable=True)  # Order price (null for market)
    avg_fill_price = Column(Numeric(precision=20, scale=8), nullable=True)  # Actual filled price
    
    # Sizing
    size = Column(Numeric(precision=20, scale=8), nullable=False)  # Order size
    filled_size = Column(Numeric(precision=20, scale=8), nullable=False, default=0)  # Filled amount
    
    # Fees
    total_fee = Column(Numeric(precision=20, scale=8), nullable=True)
    fee_currency = Column(String(20), nullable=True)
    
    # Leverage (for futures)
    leverage = Column(Numeric(precision=5, scale=2), nullable=True)
    margin_mode = Column(String(20), nullable=True)  # isolated, cross
    
    # Status
    status = Column(String(20), nullable=False)  # filled, cancelled, partially_filled
    
    # Timestamps
    created_at_exchange = Column(DateTime(timezone=True), nullable=False)  # When order was placed on exchange
    updated_at_exchange = Column(DateTime(timezone=True), nullable=True)  # Last update from exchange
    synced_at = Column(DateTime(timezone=True), server_default=func.now())  # When we synced this
    
    # Relationships
    trades = relationship("LiveTrade", back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'exchange', 'exchange_order_id', name='uix_live_order_exchange_id'),
        Index('idx_live_orders_user_symbol', 'user_id', 'symbol'),
        Index('idx_live_orders_created', 'user_id', 'created_at_exchange'),
    )


class LiveTrade(Base):
    """
    Individual trade fills/executions.
    
    A single order may have multiple fills.
    Synced from Bitget API: /api/v2/spot/trade/fills
    or /api/v2/mix/order/fills
    """
    __tablename__ = "live_trades"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("live_orders.id", ondelete="CASCADE"), nullable=True)
    
    # Exchange identifiers
    exchange = Column(String(20), nullable=False, default='bitget')
    exchange_trade_id = Column(String(100), nullable=False)  # Bitget's tradeId
    exchange_order_id = Column(String(100), nullable=False)  # Reference to order
    
    # Trade details
    symbol = Column(String(30), nullable=False)
    side = Column(String(10), nullable=False)  # buy, sell
    
    # Execution
    price = Column(Numeric(precision=20, scale=8), nullable=False)
    size = Column(Numeric(precision=20, scale=8), nullable=False)
    quote_size = Column(Numeric(precision=20, scale=8), nullable=True)  # price * size
    
    # Fees
    fee = Column(Numeric(precision=20, scale=8), nullable=False, default=0)
    fee_currency = Column(String(20), nullable=True)
    
    # Role
    role = Column(String(10), nullable=True)  # maker, taker
    
    # Profit/Loss (for closing trades)
    realized_pnl = Column(Numeric(precision=20, scale=8), nullable=True)
    
    # Timestamps
    executed_at = Column(DateTime(timezone=True), nullable=False)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    order = relationship("LiveOrder", back_populates="trades")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'exchange', 'exchange_trade_id', name='uix_live_trade_exchange_id'),
        Index('idx_live_trades_executed', 'user_id', 'executed_at'),
    )


class FinancialRecord(Base):
    """
    Financial ledger entries from exchange.
    
    Used for comprehensive balance tracking and tax reporting.
    Includes: transfers, realized PnL, funding fees, commissions.
    
    Synced from Bitget API: /api/v2/spot/account/bills
    or /api/v2/mix/account/bill
    """
    __tablename__ = "financial_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Exchange identifiers
    exchange = Column(String(20), nullable=False, default='bitget')
    record_id = Column(String(100), nullable=False)  # Bitget's billId
    
    # Record type
    record_type = Column(String(50), nullable=False)  # deposit, withdraw, trade, funding_fee, commission, etc.
    business_type = Column(String(50), nullable=True)  # More specific type from Bitget
    
    # Amounts
    amount = Column(Numeric(precision=20, scale=8), nullable=False)  # Positive = credit, Negative = debit
    currency = Column(String(20), nullable=False)  # USDT, BTC, etc.
    balance_after = Column(Numeric(precision=20, scale=8), nullable=True)  # Balance after this transaction
    
    # Related entities
    symbol = Column(String(30), nullable=True)  # Trading pair if applicable
    related_order_id = Column(String(100), nullable=True)  # Order ID if trade-related
    
    # Notes
    notes = Column(Text, nullable=True)  # Any additional info
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True), nullable=False)  # When it happened on exchange
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('user_id', 'exchange', 'record_id', name='uix_financial_record_id'),
        Index('idx_financial_records_type', 'user_id', 'record_type'),
        Index('idx_financial_records_recorded', 'user_id', 'recorded_at'),
    )


class FuturesTaxRecord(Base):
    """
    Futures tax/transaction records from Bitget Tax API.
    
    Provides 18 months of historical data (vs 90 days for regular API).
    Used for comprehensive tax reporting of Futures PnL.
    
    Synced from Bitget API: /api/v2/tax/future-record
    """
    __tablename__ = "futures_tax_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Exchange identifiers
    exchange = Column(String(20), nullable=False, default='bitget')
    record_id = Column(String(100), nullable=False)  # Bitget's id
    
    # Product type
    product_type = Column(String(30), nullable=False)  # USDT-FUTURES, USDC-FUTURES, COIN-FUTURES
    symbol = Column(String(30), nullable=False)  # e.g., TRXUSDT
    margin_coin = Column(String(20), nullable=False)  # USDT, USDC, or base coin
    
    # Tax/Transaction type
    tax_type = Column(String(50), nullable=False)  # close_long, close_short, open_long, funding_fee, etc.
    
    # Amounts
    amount = Column(Numeric(precision=24, scale=8), nullable=False)  # PnL amount (positive = profit, negative = loss)
    fee = Column(Numeric(precision=24, scale=8), nullable=True)  # Trading/funding fee
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True), nullable=False)  # When it happened on exchange
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('user_id', 'exchange', 'record_id', 'product_type', name='uix_futures_tax_record_id'),
        Index('idx_futures_tax_records_type', 'user_id', 'tax_type'),
        Index('idx_futures_tax_records_symbol', 'user_id', 'symbol'),
        Index('idx_futures_tax_records_recorded', 'user_id', 'recorded_at'),
    )
