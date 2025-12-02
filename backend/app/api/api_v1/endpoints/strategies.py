from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.services.pine_transpiler.parser import parse_pine_script

router = APIRouter()

class PineScriptRequest(BaseModel):
    script: str

class CompilationResult(BaseModel):
    success: bool
    parsed_script: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Mock database
MOCK_STRATEGIES = [
    {"id": "rsi", "name": "Relative Strength Index (RSI)", "category": "Built-in", "is_favorite": True},
    {"id": "macd", "name": "MACD", "category": "Built-in", "is_favorite": True},
    {"id": "sma", "name": "Simple Moving Average (SMA)", "category": "Built-in", "is_favorite": False},
    {"id": "ema", "name": "Exponential Moving Average (EMA)", "category": "Built-in", "is_favorite": False},
    {"id": "bollinger", "name": "Bollinger Bands", "category": "Built-in", "is_favorite": True},
]

@router.post("/compile", response_model=CompilationResult)
async def compile_strategy(request: PineScriptRequest):
    """
    Compiles a Pine Script strategy.
    Currently, this parses the script to verify syntax and structure.
    """
    try:
        parsed = parse_pine_script(request.script)
        return CompilationResult(success=True, parsed_script=parsed)
    except Exception as e:
        return CompilationResult(success=False, error=str(e))

@router.post("/save")
async def save_strategy(request: PineScriptRequest):
    """
    Saves a strategy.
    """
    # Generate a simple ID
    strategy_id = f"custom_{len(MOCK_STRATEGIES) + 1}"
    
    # Extract name from script if possible, otherwise use a default
    name = "Custom Strategy"
    for line in request.script.split('\n'):
        if line.startswith('//'): continue
        if 'strategy(' in line or 'indicator(' in line:
            if 'title="' in line:
                try:
                    name = line.split('title="')[1].split('"')[0]
                except:
                    pass
            elif "title='" in line:
                try:
                    name = line.split("title='")[1].split("'")[0]
                except:
                    pass
            break

    new_strategy = {
        "id": strategy_id,
        "name": name,
        "category": "Personal",
        "is_favorite": False,
        "script": request.script
    }
    
    MOCK_STRATEGIES.append(new_strategy)
    
    return {"status": "success", "message": "Strategy saved", "strategy": new_strategy}

class ExecutionRequest(BaseModel):
    script: str
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"

class ExecutionResult(BaseModel):
    success: bool
    signals: Optional[List[Dict[str, Any]]] = None
    indicators: Optional[Dict[str, List[Optional[float]]]] = None
    error: Optional[str] = None

@router.post("/execute", response_model=ExecutionResult)
async def execute_strategy(request: ExecutionRequest):
    """
    Executes a Pine Script strategy against mock market data.
    """
    try:
        # 1. Parse the script
        parsed = parse_pine_script(request.script)
        
        # 2. Get Mock Market Data (Synthetic for now)
        # In a real app, this would come from the database or CCXT
        import pandas as pd
        import numpy as np
        
        dates = pd.date_range(end=pd.Timestamp.now(), periods=100, freq=request.timeframe)
        # Generate synthetic price data with some trend
        close = np.linspace(40000, 45000, 100) + np.random.normal(0, 500, 100)
        
        market_data = {
            "close": pd.Series(close, index=dates),
            "open": pd.Series(close + np.random.normal(0, 100, 100), index=dates),
            "high": pd.Series(close + np.random.normal(200, 100, 100), index=dates),
            "low": pd.Series(close - np.random.normal(200, 100, 100), index=dates),
        }
        
        # 3. Execute via Interpreter
        from app.services.pine_transpiler.interpreter import execute_pine_script
        condition_results, context = execute_pine_script(parsed, market_data)
        
        # 4. Format Results
        
        # Extract signals
        signals = []
        for name, result in condition_results.items():
            # Result could be a boolean (if scalar comparison) or Series
            if isinstance(result, bool) and result:
                 # Scalar result (e.g. if close > 0), applies to last candle? 
                 # For backtesting we usually want Series. 
                 # If the interpreter evaluated conditions on the whole series, result should be a Series.
                 pass
            elif isinstance(result, pd.Series) and result.dtype == bool:
                true_indices = result[result].index
                for idx in true_indices:
                    signals.append({
                        "timestamp": idx.isoformat(),
                        "type": name,
                        "price": float(market_data["close"][idx])
                    })

        # Extract indicator values for plotting
        indicator_data = {}
        for key, value in context.items():
            if key not in ["open", "high", "low", "close", "volume"] and isinstance(value, pd.Series):
                # Convert series to list of values, handling NaN
                # Use numpy replace to handle NaN/Inf before tolist
                value_clean = value.replace([np.inf, -np.inf], np.nan)
                # Convert to list and replace NaN with None manually to ensure JSON compliance
                indicator_list = value_clean.tolist()
                indicator_data[key] = [x if pd.notnull(x) else None for x in indicator_list]

        return ExecutionResult(success=True, signals=signals, indicators=indicator_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ExecutionResult(success=False, error=str(e))

@router.get("/", response_model=List[Dict[str, Any]])
async def get_strategies():
    """
    Returns a list of available strategies.
    """
    return MOCK_STRATEGIES
