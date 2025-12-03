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
            take_profit=order_in.take_profit
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
    return portfolio

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
