"""
History Service - Sync and manage live trading history.

Orchestrates:
- Fetching order/trade/bill history from Bitget
- Storing in LiveOrder, LiveTrade, FinancialRecord tables
- CSV import for >90 day history
- CSV export for tax reporting

USAGE:
    service = HistoryService(db, user_id)
    await service.initialize()  # Loads API keys
    result = await service.sync_all()  # Fetch and store all history
"""

import logging
import csv
import io
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.base import UserSecret
from app.models.history import LiveOrder, LiveTrade, FinancialRecord, FuturesTaxRecord
from app.services.exchanges import BitgetService
from app.core.encryption import decrypt_value

logger = logging.getLogger(__name__)


class HistoryService:
    """
    Service for managing live trading history from Bitget.
    """
    
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self._bitget: Optional[BitgetService] = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        Load API credentials and initialize BitgetService.
        Must be called before sync operations.
        """
        if self._initialized:
            return True
        
        # Fetch Bitget credentials
        result = await self.db.execute(
            select(UserSecret).where(
                UserSecret.user_id == self.user_id,
                UserSecret.provider == 'bitget'
            )
        )
        secrets = result.scalars().all()
        
        if not secrets:
            raise Exception("No Bitget API keys found. Please add them in Settings.")
        
        # Extract credentials
        credentials = {}
        for secret in secrets:
            try:
                decrypted = decrypt_value(secret.encrypted_value)
                key_type = secret.key_name.lower()
                if 'api_key' in key_type or 'apikey' in key_type:
                    credentials['api_key'] = decrypted
                elif 'secret' in key_type:
                    credentials['secret'] = decrypted
                elif 'passphrase' in key_type:
                    credentials['passphrase'] = decrypted
            except Exception as e:
                logger.error(f"Failed to decrypt key {secret.key_name}: {e}")
                continue
        
        if not all(k in credentials for k in ['api_key', 'secret', 'passphrase']):
            raise Exception("Missing Bitget credentials (need api_key, secret, passphrase)")
        
        self._bitget = BitgetService(
            api_key=credentials['api_key'],
            secret=credentials['secret'],
            passphrase=credentials['passphrase']
        )
        
        self._initialized = True
        return True
    
    async def close(self):
        """Close the BitgetService connection."""
        if self._bitget:
            await self._bitget.close()
            self._bitget = None
            self._initialized = False
    
    def _ensure_initialized(self):
        if not self._initialized or not self._bitget:
            raise Exception("HistoryService not initialized. Call initialize() first.")
    
    async def sync_all(self, days: int = 90) -> Dict[str, int]:
        """
        Sync all history from Bitget (orders, trades, bills, futures tax).
        
        Args:
            days: Number of days to look back (max 90 for regular API, 540 for tax API)
            
        Returns:
            Summary dict with counts: {"orders": X, "trades": Y, "bills": Z, "futures_tax": W}
        """
        self._ensure_initialized()
        
        result = {
            "orders": 0,
            "trades": 0, 
            "bills": 0,
            "futures_tax": 0,
            "errors": []
        }
        
        # Calculate time range for regular API (90 days max)
        end_time = int(datetime.utcnow().timestamp() * 1000)
        start_time_90d = int((datetime.utcnow() - timedelta(days=min(days, 90))).timestamp() * 1000)
        
        # For Tax API: use 18 months (540 days) if days > 90
        start_time_tax = int((datetime.utcnow() - timedelta(days=min(days, 540))).timestamp() * 1000)
        
        try:
            # 1. Sync Orders
            logger.info(f"Syncing order history (last {min(days, 90)} days)...")
            orders = await self._bitget.fetch_order_history(
                start_time=start_time_90d,
                end_time=end_time,
                limit=500
            )
            result["orders"] = await self._upsert_orders(orders)
            logger.info(f"Synced {result['orders']} orders")
            
        except Exception as e:
            logger.error(f"Failed to sync orders: {e}")
            result["errors"].append(f"Orders: {str(e)}")
        
        try:
            # 2. Sync Fills/Trades
            logger.info("Syncing trade fills...")
            fills = await self._bitget.fetch_fills(
                start_time=start_time_90d,
                end_time=end_time,
                limit=500
            )
            result["trades"] = await self._upsert_trades(fills)
            logger.info(f"Synced {result['trades']} trades")
            
        except Exception as e:
            logger.error(f"Failed to sync trades: {e}")
            result["errors"].append(f"Trades: {str(e)}")
        
        try:
            # 3. Sync Bills (ledger)
            logger.info("Syncing account bills...")
            bills = await self._bitget.fetch_bills(
                start_time=start_time_90d,
                end_time=end_time,
                limit=500
            )
            result["bills"] = await self._upsert_bills(bills)
            logger.info(f"Synced {result['bills']} bills")
            
        except Exception as e:
            logger.error(f"Failed to sync bills: {e}")
            result["errors"].append(f"Bills: {str(e)}")
        
        # 4. Sync Futures Tax Records (18 months retention)
        try:
            logger.info("Syncing Futures Tax Records (USDT-M, USDC-M)...")
            futures_count = 0
            
            for product_type in ["USDT-FUTURES", "USDC-FUTURES"]:
                logger.info(f"Fetching {product_type} tax records...")
                records = await self._bitget.fetch_futures_tax_records(
                    product_type=product_type,
                    start_time=start_time_tax,
                    end_time=end_time,
                    limit=100
                )
                count = await self._upsert_futures_tax_records(records)
                futures_count += count
                logger.info(f"Synced {count} {product_type} records")
            
            result["futures_tax"] = futures_count
            logger.info(f"Total Futures Tax Records synced: {futures_count}")
            
        except Exception as e:
            logger.error(f"Failed to sync futures tax records: {e}")
            result["errors"].append(f"Futures Tax: {str(e)}")
        
        return result
    
    async def _upsert_orders(self, orders: List[Dict]) -> int:
        """Insert or update orders with deduplication."""
        count = 0
        for order in orders:
            if not order.get("exchange_order_id"):
                continue
            
            # Parse timestamp
            created_at = None
            if order.get("created_at"):
                try:
                    created_at = datetime.fromtimestamp(int(order["created_at"]) / 1000)
                except:
                    created_at = datetime.utcnow()
            
            stmt = pg_insert(LiveOrder).values(
                user_id=self.user_id,
                exchange='bitget',
                exchange_order_id=order["exchange_order_id"],
                client_order_id=order.get("client_order_id"),
                symbol=order.get("symbol", ""),
                product_type='spot',
                side=order.get("side", ""),
                order_type=order.get("order_type", ""),
                price=Decimal(str(order["price"])) if order.get("price") else None,
                avg_fill_price=Decimal(str(order["avg_fill_price"])) if order.get("avg_fill_price") else None,
                size=Decimal(str(order.get("size", 0))),
                filled_size=Decimal(str(order.get("filled_size", 0))),
                total_fee=Decimal(str(order["total_fee"])) if order.get("total_fee") else None,
                fee_currency=order.get("fee_currency"),
                status=order.get("status", "unknown"),
                created_at_exchange=created_at or datetime.utcnow()
            ).on_conflict_do_nothing(
                index_elements=['user_id', 'exchange', 'exchange_order_id']
            )
            
            result = await self.db.execute(stmt)
            if result.rowcount > 0:
                count += 1
        
        await self.db.commit()
        return count
    
    async def _upsert_trades(self, trades: List[Dict]) -> int:
        """Insert or update trades with deduplication."""
        count = 0
        for trade in trades:
            if not trade.get("exchange_trade_id"):
                continue
            
            # Parse timestamp
            executed_at = None
            if trade.get("executed_at"):
                try:
                    executed_at = datetime.fromtimestamp(int(trade["executed_at"]) / 1000)
                except:
                    executed_at = datetime.utcnow()
            
            stmt = pg_insert(LiveTrade).values(
                user_id=self.user_id,
                exchange='bitget',
                exchange_trade_id=trade["exchange_trade_id"],
                exchange_order_id=trade.get("exchange_order_id", ""),
                symbol=trade.get("symbol", ""),
                side=trade.get("side", ""),
                price=Decimal(str(trade.get("price", 0))),
                size=Decimal(str(trade.get("size", 0))),
                quote_size=Decimal(str(trade["quote_size"])) if trade.get("quote_size") else None,
                fee=Decimal(str(trade.get("fee", 0))),
                fee_currency=trade.get("fee_currency"),
                role=trade.get("role"),
                executed_at=executed_at or datetime.utcnow()
            ).on_conflict_do_nothing(
                index_elements=['user_id', 'exchange', 'exchange_trade_id']
            )
            
            result = await self.db.execute(stmt)
            if result.rowcount > 0:
                count += 1
        
        await self.db.commit()
        return count
    
    async def _upsert_bills(self, bills: List[Dict]) -> int:
        """Insert or update financial records with deduplication."""
        count = 0
        for bill in bills:
            if not bill.get("record_id"):
                continue
            
            # Parse timestamp
            recorded_at = None
            if bill.get("recorded_at"):
                try:
                    recorded_at = datetime.fromtimestamp(int(bill["recorded_at"]) / 1000)
                except:
                    recorded_at = datetime.utcnow()
            
            stmt = pg_insert(FinancialRecord).values(
                user_id=self.user_id,
                exchange='bitget',
                record_id=bill["record_id"],
                record_type=bill.get("record_type", "unknown"),
                business_type=bill.get("business_type"),
                amount=Decimal(str(bill.get("amount", 0))),
                currency=bill.get("currency", ""),
                balance_after=Decimal(str(bill["balance_after"])) if bill.get("balance_after") else None,
                symbol=bill.get("symbol"),
                related_order_id=bill.get("related_order_id"),
                recorded_at=recorded_at or datetime.utcnow()
            ).on_conflict_do_nothing(
                index_elements=['user_id', 'exchange', 'record_id']
            )
            
            result = await self.db.execute(stmt)
            if result.rowcount > 0:
                count += 1
        
        await self.db.commit()
        return count
    
    async def _upsert_futures_tax_records(self, records: List[Dict]) -> int:
        """Insert or update Futures Tax Records with deduplication."""
        count = 0
        for record in records:
            if not record.get("record_id"):
                continue
            
            # Parse timestamp
            recorded_at = None
            if record.get("recorded_at"):
                try:
                    recorded_at = datetime.fromtimestamp(int(record["recorded_at"]) / 1000)
                except:
                    recorded_at = datetime.utcnow()
            
            stmt = pg_insert(FuturesTaxRecord).values(
                user_id=self.user_id,
                exchange='bitget',
                record_id=record["record_id"],
                product_type=record.get("product_type", "USDT-FUTURES"),
                symbol=record.get("symbol", ""),
                margin_coin=record.get("margin_coin", "USDT"),
                tax_type=record.get("tax_type", "unknown"),
                amount=Decimal(str(record.get("amount", 0))),
                fee=Decimal(str(record.get("fee", 0))) if record.get("fee") else None,
                recorded_at=recorded_at or datetime.utcnow()
            ).on_conflict_do_nothing(
                index_elements=['user_id', 'exchange', 'record_id', 'product_type']
            )
            
            result = await self.db.execute(stmt)
            if result.rowcount > 0:
                count += 1
        
        await self.db.commit()
        return count
    
    async def get_balance(self) -> Dict[str, Any]:
        """Get current account balance from Bitget."""
        self._ensure_initialized()
        return await self._bitget.fetch_balance()
    
    async def get_orders(
        self, 
        limit: int = 50, 
        offset: int = 0,
        symbol: Optional[str] = None
    ) -> List[LiveOrder]:
        """Get synced orders from database."""
        query = select(LiveOrder).where(
            LiveOrder.user_id == self.user_id
        ).order_by(LiveOrder.created_at_exchange.desc())
        
        if symbol:
            query = query.where(LiveOrder.symbol == symbol.replace("/", ""))
        
        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_trades(
        self, 
        limit: int = 50, 
        offset: int = 0
    ) -> List[LiveTrade]:
        """Get synced trades from database."""
        query = select(LiveTrade).where(
            LiveTrade.user_id == self.user_id
        ).order_by(LiveTrade.executed_at.desc()).offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def export_csv(self, year: Optional[int] = None) -> str:
        """
        Export trades and financial records as CSV for tax reporting.
        
        Returns CSV content as string.
        """
        # Determine date range
        if year:
            start_date = datetime(year, 1, 1)
            end_date = datetime(year, 12, 31, 23, 59, 59)
        else:
            start_date = datetime(datetime.utcnow().year, 1, 1)
            end_date = datetime.utcnow()
        
        # Fetch trades
        query = select(LiveTrade).where(
            LiveTrade.user_id == self.user_id,
            LiveTrade.executed_at >= start_date,
            LiveTrade.executed_at <= end_date
        ).order_by(LiveTrade.executed_at)
        
        result = await self.db.execute(query)
        trades = result.scalars().all()
        
        # Build CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Date", "Time", "Symbol", "Side", "Price", "Size", 
            "Quote Amount", "Fee", "Fee Currency", "Role", "Exchange"
        ])
        
        for trade in trades:
            writer.writerow([
                trade.executed_at.strftime("%Y-%m-%d"),
                trade.executed_at.strftime("%H:%M:%S"),
                trade.symbol,
                trade.side.upper(),
                str(trade.price),
                str(trade.size),
                str(trade.quote_size) if trade.quote_size else "",
                str(trade.fee),
                trade.fee_currency or "",
                trade.role or "",
                trade.exchange
            ])
        
        return output.getvalue()
