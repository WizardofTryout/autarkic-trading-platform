from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.services.pine_transpiler.parser import parse_pine_script
from app.models.base import User, Strategy
from app.api import deps
import uuid

router = APIRouter()

class PineScriptRequest(BaseModel):
    script: str

class CompilationResult(BaseModel):
    success: bool
    parsed_script: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class StrategyResponse(BaseModel):
    id: str
    name: str
    category: str
    is_favorite: bool
    script: str

    class Config:
        from_attributes = True

@router.post("/compile", response_model=CompilationResult)
async def compile_strategy(request: PineScriptRequest):
    try:
        parsed = parse_pine_script(request.script)
        return CompilationResult(success=True, parsed_script=parsed)
    except Exception as e:
        return CompilationResult(success=False, error=str(e))

@router.post("/save")
async def save_strategy(
    request: PineScriptRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Extract name
    name = "Custom Strategy"
    for line in request.script.split('\n'):
        if line.startswith('//'): continue
        if 'strategy(' in line or 'indicator(' in line:
            if 'title="' in line:
                try: name = line.split('title="')[1].split('"')[0]
                except: pass
            elif "title='" in line:
                try: name = line.split("title='")[1].split("'")[0]
                except: pass
            break

    new_strategy = Strategy(
        user_id=current_user.id,
        name=name,
        source_code=request.script,
        category="Personal",
        is_favorite=False,
        status="active"
    )
    db.add(new_strategy)
    await db.commit()
    await db.refresh(new_strategy)
    
    return {"status": "success", "message": "Strategy saved", "strategy": {
        "id": str(new_strategy.id),
        "name": new_strategy.name,
        "category": new_strategy.category,
        "is_favorite": new_strategy.is_favorite,
        "script": new_strategy.source_code
    }}

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
            # Check built-ins first (mock for now)
            built_ins = {
                "rsi": "study('RSI')...", # Placeholder
                "macd": "study('MACD')..."
            }
            if request.strategy_id in built_ins:
                script_content = built_ins[request.strategy_id]
            else:
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
        
        # 2. Mock Data (Same as before)
        import pandas as pd
        import numpy as np
        tf_map = {"1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min", "1h": "1h", "4h": "4h", "1d": "1D"}
        freq = tf_map.get(request.timeframe, "1h")
        dates = pd.date_range(end=pd.Timestamp.now(), periods=100, freq=freq)
        close = np.linspace(40000, 45000, 100) + np.random.normal(0, 500, 100)
        market_data = {
            "close": pd.Series(close, index=dates),
            "open": pd.Series(close + np.random.normal(0, 100, 100), index=dates),
            "high": pd.Series(close + np.random.normal(200, 100, 100), index=dates),
            "low": pd.Series(close - np.random.normal(200, 100, 100), index=dates),
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

@router.get("/", response_model=List[StrategyResponse])
async def get_strategies(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Fetch user strategies
    result = await db.execute(select(Strategy).where(Strategy.user_id == current_user.id))
    user_strategies = result.scalars().all()
    
    response = []
    
    # Add built-ins (Mock for now)
    built_ins = [
        {"id": "rsi", "name": "Relative Strength Index (RSI)", "category": "Built-in", "is_favorite": True, "script": "// RSI"},
        {"id": "macd", "name": "MACD", "category": "Built-in", "is_favorite": True, "script": "// MACD"},
        {"id": "sma", "name": "Simple Moving Average (SMA)", "category": "Built-in", "is_favorite": False, "script": "// SMA"},
        {"id": "ema", "name": "Exponential Moving Average (EMA)", "category": "Built-in", "is_favorite": False, "script": "// EMA"},
        {"id": "bollinger", "name": "Bollinger Bands", "category": "Built-in", "is_favorite": True, "script": "// BB"},
    ]
    
    for s in built_ins:
        response.append(StrategyResponse(**s))
        
    for s in user_strategies:
        response.append(StrategyResponse(
            id=str(s.id),
            name=s.name,
            category=s.category,
            is_favorite=s.is_favorite,
            script=s.source_code
        ))
        
    return response
