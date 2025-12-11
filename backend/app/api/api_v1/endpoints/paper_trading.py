from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.base import User
from app.services.paper_trading import PaperTradingService
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter()

class PaperOrderCreate(BaseModel):
    symbol: str
    side: str
    amount: float
    leverage: int = 1
    type: str = "MARKET"
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    is_trailing_stop: bool = False
    trailing_percent: Optional[float] = None

class ResetRequest(BaseModel):
    confirm: bool

@router.post("/order")
async def place_order(
    order_in: PaperOrderCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    service = PaperTradingService(db)
    try:
        return await service.place_order(
            user_id=current_user.id,
            symbol=order_in.symbol,
            side=order_in.side,
            amount_usdt=order_in.amount,
            leverage=order_in.leverage,
            order_type=order_in.type,
            price=order_in.price,
            stop_loss=order_in.stop_loss,
            take_profit=order_in.take_profit,
            is_trailing_stop=order_in.is_trailing_stop,
            trailing_percent=order_in.trailing_percent
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    service = PaperTradingService(db)
    portfolio = await service.get_portfolio(current_user.id)
    
    # Calculate reserved margin from open orders
    reserved_margin = sum(float(order.amount) for order in portfolio["orders"])
    available_balance = float(portfolio["balance"]) - reserved_margin
    
    # Fetch current prices for all position symbols
    positions_with_prices = []
    for pos in portfolio["positions"]:
        # Get current market price
        mark_price = None
        unrealized_pnl = 0.0
        try:
            current_price = await service.market_service.get_current_price(pos.symbol)
            if current_price:
                mark_price = float(current_price)
                entry_price = float(pos.entry_price)
                size = float(pos.size)
                side = pos.side.upper() if pos.side else ""
                
                # Calculate unrealized PnL based on position direction
                if side in ("LONG", "BUY"):
                    unrealized_pnl = (mark_price - entry_price) * size
                elif side in ("SHORT", "SELL"):
                    unrealized_pnl = (entry_price - mark_price) * size
        except Exception as e:
            print(f"Error fetching price for {pos.symbol}: {e}")
        
        positions_with_prices.append({
            "id": str(pos.id),
            "symbol": pos.symbol,
            "side": pos.side,
            "size": float(pos.size),
            "entry_price": float(pos.entry_price),
            "mark_price": mark_price,  # Current market price
            "unrealized_pnl": round(unrealized_pnl, 2),  # Calculated PnL
            "leverage": pos.leverage,
            "margin": float(pos.margin),
            "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
            "take_profit": float(pos.take_profit) if pos.take_profit else None,
            "is_trailing_stop": pos.is_trailing_stop,
            "trailing_percent": float(pos.trailing_percent) if pos.trailing_percent else None,
            "liquidation_price": float(pos.liquidation_price) if pos.liquidation_price else None,
        })
    
    # Convert SQLAlchemy objects to dicts for JSON serialization
    return {
        "balance": available_balance,  # Show available balance (total - reserved)
        "positions": positions_with_prices,
        "orders": [
            {
                "id": str(order.id),
                "symbol": order.symbol,
                "side": order.side,
                "type": order.type,
                "price": float(order.price) if order.price else None,
                "amount": float(order.amount),
                "quantity": float(order.quantity),
                "filled_quantity": float(order.filled_quantity),
                "status": order.status,
                "created_at": order.created_at.isoformat(),
                "stop_loss": float(order.stop_loss) if order.stop_loss else None,
                "take_profit": float(order.take_profit) if order.take_profit else None,
            }
            for order in portfolio["orders"]
        ],
        "history": [
            {
                "id": str(order.id),
                "symbol": order.symbol,
                "side": order.side,
                "type": order.type,
                "price": float(order.price) if order.price else None,
                "amount": float(order.amount),
                "quantity": float(order.quantity),
                "filled_quantity": float(order.filled_quantity),
                "status": order.status,
                "created_at": order.created_at.isoformat(),
            }
            for order in portfolio["history"]
        ]
    }

@router.delete("/order/{order_id}")
async def cancel_order(
    order_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    service = PaperTradingService(db)
    try:
        await service.cancel_order(current_user.id, order_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class PaperOrderUpdate(BaseModel):
    price: Optional[float] = None
    amount: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

@router.put("/order/{order_id}")
async def update_order(
    order_id: uuid.UUID,
    order_update: PaperOrderUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    service = PaperTradingService(db)
    try:
        order = await service.update_order(
            user_id=current_user.id,
            order_id=order_id,
            price=order_update.price,
            amount=order_update.amount,
            stop_loss=order_update.stop_loss,
            take_profit=order_update.take_profit
        )
        return {"status": "success", "order_id": str(order.id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reset")
async def reset_account(
    request: ResetRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")
        
    service = PaperTradingService(db)
    account = await service.reset_account(current_user.id)
    return {"status": "success", "balance": account.balance}
