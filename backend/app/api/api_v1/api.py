from fastapi import APIRouter
from app.api.api_v1.endpoints import auth, market, trade

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(trade.router, prefix="/trade", tags=["trade"])
