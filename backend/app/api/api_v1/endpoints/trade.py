from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.services.paper_trading import PaperTradingService
from app.models.base import User
from typing import Optional

router = APIRouter()

class TradeRequest(BaseModel):
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

@router.post("/execute")
async def execute_trade(
    request: TradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PaperTradingService(db)
    try:
        order = await service.place_order(
            user_id=current_user.id,
            symbol=request.symbol,
            side=request.side,
            amount_usdt=request.amount,
            leverage=request.leverage,
            order_type=request.type,
            price=request.price,
            stop_loss=request.stop_loss,
            take_profit=request.take_profit,
            is_trailing_stop=request.is_trailing_stop,
            trailing_percent=request.trailing_percent
        )
        return {"status": "success", "order_id": str(order.id), "details": request.dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
