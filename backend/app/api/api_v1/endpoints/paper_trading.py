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
    
    # Convert SQLAlchemy objects to dicts for JSON serialization
    return {
        "balance": float(portfolio["balance"]),
        "positions": [
            {
                "id": str(pos.id),
                "symbol": pos.symbol,
                "side": pos.side,
                "size": float(pos.size),
                "entry_price": float(pos.entry_price),
                "leverage": pos.leverage,
                "margin": float(pos.margin),
                "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
                "take_profit": float(pos.take_profit) if pos.take_profit else None,
                "is_trailing_stop": pos.is_trailing_stop,
                "trailing_percent": float(pos.trailing_percent) if pos.trailing_percent else None,
                "liquidation_price": float(pos.liquidation_price) if pos.liquidation_price else None,
            }
            for pos in portfolio["positions"]
        ],
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
