from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.services.pine_transpiler.parser import parse_pine_script
from app.models.base import User, Strategy, ActiveStrategy
from app.api import deps
from datetime import datetime
import uuid

router = APIRouter()

class PineScriptRequest(BaseModel):
    script: str

class CompilationResult(BaseModel):
    success: bool
    parsed_script: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ExecutionRequest(BaseModel):
    script: Optional[str] = None
    strategy_id: Optional[str] = None
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"

class ExecutionResult(BaseModel):
    success: bool
    signals: Optional[List[Dict[str, Any]]] = None
    indicators: Optional[Dict[str, List[Optional[float]]]] = None
    error: Optional[str] = None

# --- Schemas ---

class StrategyBase(BaseModel):
    name: str
    source_code: str
    category: Optional[str] = "Personal"
    is_favorite: bool = False

class StrategyCreate(StrategyBase):
    pass

class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    source_code: Optional[str] = None
    category: Optional[str] = None
    is_favorite: Optional[bool] = None

class StrategyResponse(StrategyBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    status: str

    class Config:
        from_attributes = True

class ActiveStrategyCreate(BaseModel):
    strategy_id: str
    symbol: str
    timeframe: str
    amount: float

class ActiveStrategyResponse(BaseModel):
    id: uuid.UUID
    strategy_id: uuid.UUID
    symbol: str
    timeframe: str
    amount: float
    status: str
    created_at: datetime
    strategy_name: str

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/", response_model=List[StrategyResponse])
async def get_strategies(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(Strategy).where(Strategy.user_id == current_user.id).order_by(Strategy.created_at.desc()))
    return result.scalars().all()

@router.post("/", response_model=StrategyResponse)
async def create_strategy(
    strategy_in: StrategyCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    strategy = Strategy(
        user_id=current_user.id,
        name=strategy_in.name,
        source_code=strategy_in.source_code,
        category=strategy_in.category,
        is_favorite=strategy_in.is_favorite,
        status="draft"
    )
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return strategy

@router.put("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: str,
    strategy_in: StrategyUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id, Strategy.user_id == current_user.id))
    strategy = result.scalars().first()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    update_data = strategy_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(strategy, field, value)
    
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return strategy

@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id, Strategy.user_id == current_user.id))
    strategy = result.scalars().first()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    await db.delete(strategy)
    await db.commit()
    return {"message": "Strategy deleted"}

# --- Activation Endpoints ---

@router.post("/activate", response_model=ActiveStrategyResponse)
async def activate_strategy(
    activation_in: ActiveStrategyCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Verify strategy ownership
    result = await db.execute(select(Strategy).where(Strategy.id == activation_in.strategy_id, Strategy.user_id == current_user.id))
    strategy = result.scalars().first()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    active_strategy = ActiveStrategy(
        user_id=current_user.id,
        strategy_id=activation_in.strategy_id,
        symbol=activation_in.symbol,
        timeframe=activation_in.timeframe,
        amount=activation_in.amount,
        status="RUNNING"
    )
    db.add(active_strategy)
    await db.commit()
    await db.refresh(active_strategy)

    return ActiveStrategyResponse(
        id=active_strategy.id,
        strategy_id=active_strategy.strategy_id,
        symbol=active_strategy.symbol,
        timeframe=active_strategy.timeframe,
        amount=active_strategy.amount,
        status=active_strategy.status,
        created_at=active_strategy.created_at,
        strategy_name=strategy.name
    )

@router.get("/active", response_model=List[ActiveStrategyResponse])
async def get_active_strategies(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Join with Strategy to get the name
    result = await db.execute(
        select(ActiveStrategy, Strategy.name)
        .join(Strategy, ActiveStrategy.strategy_id == Strategy.id)
        .where(ActiveStrategy.user_id == current_user.id)
        .order_by(ActiveStrategy.created_at.desc())
    )
    
    response = []
    for active, name in result:
        response.append(ActiveStrategyResponse(
            id=active.id,
            strategy_id=active.strategy_id,
            symbol=active.symbol,
            timeframe=active.timeframe,
            amount=active.amount,
            status=active.status,
            created_at=active.created_at,
            strategy_name=name
        ))
    return response

@router.post("/stop/{active_id}")
async def stop_strategy(
    active_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(ActiveStrategy).where(ActiveStrategy.id == active_id, ActiveStrategy.user_id == current_user.id))
    active = result.scalars().first()
    if not active:
        raise HTTPException(status_code=404, detail="Active strategy not found")
    
    active.status = "STOPPED"
    db.add(active)
    await db.commit()
    return {"message": "Strategy stopped"}

# --- Legacy/Existing Endpoints (Compile/Execute) ---

@router.post("/compile", response_model=CompilationResult)
async def compile_strategy(request: PineScriptRequest):
    try:
        parsed = parse_pine_script(request.script)
        return CompilationResult(success=True, parsed_script=parsed)
    except Exception as e:
        return CompilationResult(success=False, error=str(e))

@router.post("/execute", response_model=ExecutionResult)
async def execute_strategy(
    request: ExecutionRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    try:
        script_content = request.script
        
        # If strategy_id provided, fetch from DB
        if request.strategy_id:
            try:
                # Check DB
                result = await db.execute(select(Strategy).where(
                    Strategy.id == uuid.UUID(request.strategy_id),
                    Strategy.user_id == current_user.id
                ))
                strategy = result.scalars().first()
                if strategy:
                    script_content = strategy.source_code
            except ValueError:
                pass # Invalid UUID

        if not script_content:
             return ExecutionResult(success=False, error="No script provided or strategy not found")

        # 1. Parse
        parsed = parse_pine_script(script_content)
        
        # 2. Fetch Real Data
        from app.services.market_service import MarketService
        market_service = MarketService()
        try:
            ohlcv_data = await market_service.get_ohlcv(request.symbol, request.timeframe, limit=200)
        finally:
            await market_service.close()

        if not ohlcv_data:
             return ExecutionResult(success=False, error=f"No data found for {request.symbol}")

        import pandas as pd
        import numpy as np
        df = pd.DataFrame(ohlcv_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        
        market_data = {
            "open": df['open'],
            "high": df['high'],
            "low": df['low'],
            "close": df['close'],
            "volume": df['volume']
        }
        
        # 3. Execute
        from app.services.pine_transpiler.interpreter import execute_pine_script
        condition_results, context = execute_pine_script(parsed, market_data)
        
        # 4. Format
        signals = []
        for name, result in condition_results.items():
            if isinstance(result, pd.Series) and result.dtype == bool:
                true_indices = result[result].index
                for idx in true_indices:
                    signals.append({
                        "timestamp": idx.isoformat(),
                        "type": name,
                        "price": float(market_data["close"][idx])
                    })

        indicator_data = {}
        for key, value in context.items():
            if key not in ["open", "high", "low", "close", "volume"] and isinstance(value, pd.Series):
                value_clean = value.replace([np.inf, -np.inf], np.nan)
                indicator_list = value_clean.tolist()
                indicator_data[key] = [x if pd.notnull(x) else None for x in indicator_list]

        return ExecutionResult(success=True, signals=signals, indicators=indicator_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ExecutionResult(success=False, error=str(e))
