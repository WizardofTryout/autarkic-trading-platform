"""add_ai_transpiler_fields

Revision ID: 59e536ee5c13
Revises: d67682b47b46
Create Date: 2025-12-05 12:19:28.068172

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59e536ee5c13'
down_revision = 'd67682b47b46'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add python_code column (TEXT, nullable)
    op.add_column('strategies', sa.Column('python_code', sa.Text(), nullable=True))
    
    # Add compiled_at column (TIMESTAMP, nullable)
    op.add_column('strategies', sa.Column('compiled_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove columns in reverse order
    op.drop_column('strategies', 'compiled_at')
    op.drop_column('strategies', 'python_code')
