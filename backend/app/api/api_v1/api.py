from fastapi import APIRouter
from app.api.api_v1.endpoints import auth, market, trade, settings, strategies, ai, research, paper_trading, ai_strategy, users, fleet, fleet_ws, history

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(trade.router, prefix="/trade", tags=["trade"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(ai_strategy.router, prefix="/ai-strategy", tags=["ai-strategy"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
api_router.include_router(paper_trading.router, prefix="/paper", tags=["paper-trading"])
api_router.include_router(users.router, prefix="/users", tags=["users"])

# AI Trading Fleet
api_router.include_router(fleet.router, prefix="/fleet", tags=["fleet"])
api_router.include_router(fleet_ws.router, prefix="/fleet/ws", tags=["fleet-websocket"])

# History & Account Sync (Phase 5)
api_router.include_router(history.router, prefix="/history", tags=["history"])
