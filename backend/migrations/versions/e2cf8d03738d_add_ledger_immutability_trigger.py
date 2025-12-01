"""Add ledger immutability trigger

Revision ID: e2cf8d03738d
Revises: 627215b01e75
Create Date: 2025-12-01 22:22:00.101486

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e2cf8d03738d'
down_revision = '627215b01e75'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_ledger_update_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Ledger entries are immutable';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trigger_prevent_ledger_update_delete
        BEFORE UPDATE OR DELETE ON ledger_entries
        FOR EACH ROW
        EXECUTE FUNCTION prevent_ledger_update_delete();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trigger_prevent_ledger_update_delete ON ledger_entries;")
    op.execute("DROP FUNCTION IF EXISTS prevent_ledger_update_delete();")
