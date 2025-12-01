from fastapi import APIRouter

router = APIRouter()

@router.get("/ticker/{symbol}")
async def get_ticker(symbol: str):
    return {"symbol": symbol, "price": 45000.0}
