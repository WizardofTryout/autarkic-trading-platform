from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class TradeRequest(BaseModel):
    symbol: str
    side: str
    amount: float

@router.post("/execute")
async def execute_trade(request: TradeRequest):
    # Mock trade execution
    return {"status": "filled", "order_id": "mock_123", "details": request.dict()}
