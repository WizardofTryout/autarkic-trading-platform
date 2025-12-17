"""Add futures_tax_records table

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6a7b8c9
Create Date: 2025-12-17

Phase 5.3: Futures Tax Records (18 months retention)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e5f6g7h8i9j0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create futures_tax_records table
    op.create_table(
        'futures_tax_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('exchange', sa.String(20), nullable=False, server_default='bitget'),
        sa.Column('record_id', sa.String(100), nullable=False),
        sa.Column('product_type', sa.String(30), nullable=False),
        sa.Column('symbol', sa.String(30), nullable=False),
        sa.Column('margin_coin', sa.String(20), nullable=False),
        sa.Column('tax_type', sa.String(50), nullable=False),
        sa.Column('amount', sa.Numeric(24, 8), nullable=False),
        sa.Column('fee', sa.Numeric(24, 8), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_futures_tax_records_user', 'futures_tax_records', ['user_id'])
    op.create_index('idx_futures_tax_records_type', 'futures_tax_records', ['user_id', 'tax_type'])
    op.create_index('idx_futures_tax_records_symbol', 'futures_tax_records', ['user_id', 'symbol'])
    op.create_index('idx_futures_tax_records_recorded', 'futures_tax_records', ['user_id', 'recorded_at'])
    
    # Create unique constraint
    op.create_unique_constraint(
        'uix_futures_tax_record_id',
        'futures_tax_records',
        ['user_id', 'exchange', 'record_id', 'product_type']
    )


def downgrade() -> None:
    op.drop_table('futures_tax_records')
