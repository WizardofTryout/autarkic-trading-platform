"""
History API Endpoints.

Provides REST API for:
- Syncing trade history from Bitget
- Fetching orders and trades
- Getting account balance
- Exporting CSV for tax reporting
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.base import User
from app.services.history_service import HistoryService

router = APIRouter()


# ====================== Schemas ======================

class SyncResponse(BaseModel):
    success: bool
    orders: int
    trades: int
    bills: int
    futures_tax: int = 0
    errors: List[str]


class BalanceAsset(BaseModel):
    free: float
    used: float
    total: float


class BalanceResponse(BaseModel):
    balances: dict  # Dict[str, BalanceAsset]


class OrderItem(BaseModel):
    id: str
    exchange_order_id: str
    symbol: str
    side: str
    order_type: str
    price: Optional[float]
    avg_fill_price: Optional[float]
    size: float
    filled_size: float
    total_fee: Optional[float]
    fee_currency: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TradeItem(BaseModel):
    id: str
    exchange_trade_id: str
    symbol: str
    side: str
    price: float
    size: float
    fee: float
    fee_currency: Optional[str]
    role: Optional[str]
    executed_at: datetime
    
    class Config:
        from_attributes = True


class OrdersResponse(BaseModel):
    orders: List[OrderItem]
    total: int


class TradesResponse(BaseModel):
    trades: List[TradeItem]
    total: int


class FuturesPnLItem(BaseModel):
    id: str
    record_id: str
    symbol: str
    margin_coin: str
    tax_type: str
    amount: float
    fee: Optional[float]
    recorded_at: datetime
    product_type: str
    
    class Config:
        from_attributes = True


class FuturesPnLResponse(BaseModel):
    records: List[FuturesPnLItem]
    total: int


# ====================== Endpoints ======================

@router.post("/sync", response_model=SyncResponse)
async def sync_history(
    days: int = 90,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync trade history from Bitget.
    
    Fetches orders, trades, bills, and futures tax records.
    - Regular API (orders, trades, bills): max 90 days
    - Tax API (futures_tax): up to 540 days (18 months)
    
    Data is deduplicated - running multiple times is safe.
    
    Args:
        days: Number of days to sync (90 for regular, up to 540 for futures tax)
    """
    service = HistoryService(db, current_user.id)
    
    try:
        await service.initialize()
        result = await service.sync_all(days=min(days, 540))
        
        return SyncResponse(
            success=len(result.get("errors", [])) == 0,
            orders=result.get("orders", 0),
            trades=result.get("trades", 0),
            bills=result.get("bills", 0),
            futures_tax=result.get("futures_tax", 0),
            errors=result.get("errors", [])
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    finally:
        await service.close()


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current account balance from Bitget.
    
    Returns balances for all assets with free, used, and total amounts.
    """
    service = HistoryService(db, current_user.id)
    
    try:
        await service.initialize()
        balances = await service.get_balance()
        
        return BalanceResponse(balances=balances)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    finally:
        await service.close()


@router.get("/orders", response_model=OrdersResponse)
async def get_orders(
    limit: int = 50,
    offset: int = 0,
    symbol: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get synced order history from database.
    
    Returns paginated list of orders.
    Use POST /sync first to fetch latest data from Bitget.
    """
    service = HistoryService(db, current_user.id)
    
    try:
        orders = await service.get_orders(limit=limit, offset=offset, symbol=symbol)
        
        return OrdersResponse(
            orders=[
                OrderItem(
                    id=str(o.id),
                    exchange_order_id=o.exchange_order_id,
                    symbol=o.symbol,
                    side=o.side,
                    order_type=o.order_type,
                    price=float(o.price) if o.price else None,
                    avg_fill_price=float(o.avg_fill_price) if o.avg_fill_price else None,
                    size=float(o.size),
                    filled_size=float(o.filled_size),
                    total_fee=float(o.total_fee) if o.total_fee else None,
                    fee_currency=o.fee_currency,
                    status=o.status,
                    created_at=o.created_at_exchange
                )
                for o in orders
            ],
            total=len(orders)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/trades", response_model=TradesResponse)
async def get_trades(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get synced trade fills from database.
    
    Returns paginated list of individual trade executions.
    Use POST /sync first to fetch latest data from Bitget.
    """
    service = HistoryService(db, current_user.id)
    
    try:
        trades = await service.get_trades(limit=limit, offset=offset)
        
        return TradesResponse(
            trades=[
                TradeItem(
                    id=str(t.id),
                    exchange_trade_id=t.exchange_trade_id,
                    symbol=t.symbol,
                    side=t.side,
                    price=float(t.price),
                    size=float(t.size),
                    fee=float(t.fee),
                    fee_currency=t.fee_currency,
                    role=t.role,
                    executed_at=t.executed_at
                )
                for t in trades
            ],
            total=len(trades)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/futures-pnl", response_model=FuturesPnLResponse)
async def get_futures_pnl(
    limit: int = 100,
    offset: int = 0,
    symbol: Optional[str] = None,
    tax_type: Optional[str] = None,
    date_from: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Futures PnL records (from API sync or CSV import).
    
    These are stored in the futures_tax_records table and include
    18 months of history from the Bitget Tax API or imported CSVs.
    
    Args:
        limit: Max records to return (default 100)
        offset: Pagination offset
        symbol: Filter by trading pair (e.g., BTCUSDT)
        tax_type: Filter by type (open_long, close_short, etc.)
        date_from: ISO date string for minimum date filter (e.g., 2024-01-01)
    """
    service = HistoryService(db, current_user.id)
    
    # Parse date_from if provided
    date_from_dt = None
    if date_from:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date format: {date_from}. Use ISO format (YYYY-MM-DD)"
            )
    
    try:
        records = await service.get_futures_pnl(
            limit=limit, 
            offset=offset, 
            symbol=symbol, 
            tax_type=tax_type,
            date_from=date_from_dt
        )
        total = await service.get_futures_pnl_count(
            symbol=symbol,
            tax_type=tax_type,
            date_from=date_from_dt
        )
        
        return FuturesPnLResponse(
            records=[
                FuturesPnLItem(
                    id=str(r.id),
                    record_id=r.record_id,
                    symbol=r.symbol,
                    margin_coin=r.margin_coin,
                    tax_type=r.tax_type,
                    amount=float(r.amount),
                    fee=float(r.fee) if r.fee else None,
                    recorded_at=r.recorded_at,
                    product_type=r.product_type
                )
                for r in records
            ],
            total=total
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/export")
async def export_csv(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export trade history as CSV for tax reporting.
    
    Args:
        year: Year to export (defaults to current year)
        
    Returns downloadable CSV file.
    """
    service = HistoryService(db, current_user.id)
    
    try:
        csv_content = await service.export_csv(year=year)
        
        filename = f"bitget_trades_{year or datetime.utcnow().year}.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


class ImportResponse(BaseModel):
    success: bool
    imported: int
    skipped: int
    total_rows: int
    errors: List[str]


@router.post("/import", response_model=ImportResponse)
async def import_csv(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import Bitget Futures order CSV export.
    
    Upload a CSV file exported from Bitget with the following columns:
    Date, Direction, Coin, Futures, order source, Transaction type,
    Price, Average Price, Order amount, Executed, Realized P/L, NetProfits, Status
    
    Cancelled orders are automatically skipped.
    Duplicate records are deduplicated (safe to upload same file multiple times).
    """
    # Validate file type
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file"
        )
    
    try:
        # Read file content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        service = HistoryService(db, current_user.id)
        result = await service.import_csv(csv_content)
        
        return ImportResponse(
            success=len(result.get("errors", [])) == 0,
            imported=result.get("imported", 0),
            skipped=result.get("skipped", 0),
            total_rows=result.get("total_rows", 0),
            errors=result.get("errors", [])
        )
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File encoding error. Please ensure the CSV is UTF-8 encoded."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
