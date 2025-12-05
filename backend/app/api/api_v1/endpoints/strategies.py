from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.services.pine_transpiler.parser import parse_pine_script
from app.services.ai_transpiler import transpile_pine_to_python
from app.models.base import User, Strategy, ActiveStrategy, PaperPosition
from app.api import deps
from datetime import datetime
from decimal import Decimal
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
    python_code: Optional[str] = None  # AI-generated Python code

import re

class StrategyResponse(StrategyBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    status: str
    type: str
    python_code: Optional[str] = None
    compiled_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ActiveStrategyCreate(BaseModel):
    strategy_id: str
    symbol: str
    timeframe: str
    amount: float
    risk_per_trade: Optional[float] = 0.01
    risk_reward_ratio: Optional[float] = 2.0
    stop_loss_percent: Optional[float] = 0.02
    use_trailing_stop: Optional[bool] = False
    trailing_stop_percent: Optional[float] = None

class ActiveStrategyResponse(BaseModel):
    id: uuid.UUID
    strategy_id: uuid.UUID
    symbol: str
    timeframe: str
    amount: float
    status: str
    created_at: datetime
    strategy_name: str
    risk_per_trade: Optional[float]
    risk_reward_ratio: Optional[float]
    stop_loss_percent: Optional[float]
    use_trailing_stop: Optional[bool]
    trailing_stop_percent: Optional[float]

    class Config:
        from_attributes = True

class BacktestRequest(BaseModel):
    script: str
    symbol: str
    timeframe: str
    start_date: datetime
    end_date: datetime
    initial_capital: Optional[float] = 10000.0
    take_profit: Optional[float] = 0.0
    stop_loss: Optional[float] = 0.0

class BacktestResult(BaseModel):
    metrics: Dict[str, Any]
    trades: List[Dict[str, Any]]
    equity_curve: List[Dict[str, Any]]
    error: Optional[str] = None

class TranspileRequest(BaseModel):
    pine_script: str

class TranspileResponse(BaseModel):
    python_code: str
    status: str

class ComposeRequest(BaseModel):
    indicator_ids: List[str]  # List of indicator strategy IDs
    composition_prompt: str  # User's instructions for combining

class ComposeResponse(BaseModel):
    python_code: str
    status: str
    indicators_used: List[str]  # Names of indicators combined

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
    # Auto-detect type
    is_indicator = re.search(r"^\s*indicator\(", strategy_in.source_code, re.MULTILINE)
    strategy_type = "indicator" if is_indicator else "strategy"

    strategy = Strategy(
        user_id=current_user.id,
        name=strategy_in.name,
        source_code=strategy_in.source_code,
        category=strategy_in.category,
        is_favorite=strategy_in.is_favorite,
        status="draft",
        type=strategy_type
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
    
    # Re-detect type if source code changes
    if "source_code" in update_data:
        is_indicator = re.search(r"^\s*indicator\(", update_data["source_code"], re.MULTILINE)
        update_data["type"] = "indicator" if is_indicator else "strategy"
    
    # Set compiled_at timestamp if python_code is provided
    if "python_code" in update_data and update_data["python_code"]:
        update_data["compiled_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(strategy, field, value)
    
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return strategy

class StrategySaveRequest(BaseModel):
    """Request model for saving a strategy via the /save endpoint"""
    script: str  # Pine Script source code
    name: Optional[str] = None  # Optional name, will be extracted from script if not provided
    python_code: Optional[str] = None  # Optional Python code (from transpiler)

@router.post("/save", response_model=StrategyResponse)
async def save_strategy(
    request: StrategySaveRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Save a strategy (Pine Script with optional Python code).
    This endpoint handles both creating new strategies and updating existing ones.
    """
    # Extract strategy name from script if not provided
    name = request.name
    if not name:
        match = re.search(r'strategy\("([^"]+)"', request.script)
        if match:
            name = match.group(1)
        else:
            match = re.search(r'indicator\("([^"]+)"', request.script)
            if match:
                name = match.group(1)
            else:
                name = "Unnamed Strategy"
    
    # Auto-detect type
    is_indicator = re.search(r"^\s*indicator\(", request.script, re.MULTILINE)
    strategy_type = "indicator" if is_indicator else "strategy"
    
    # Check if strategy with same name exists for this user
    result = await db.execute(
        select(Strategy).where(
            Strategy.name == name,
            Strategy.user_id == current_user.id
        )
    )
    existing = result.scalars().first()
    
    if existing:
        # Update existing strategy
        existing.source_code = request.script
        existing.type = strategy_type
        if request.python_code:
            existing.python_code = request.python_code
            existing.compiled_at = datetime.utcnow()
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        # Create new strategy
        strategy = Strategy(
            user_id=current_user.id,
            name=name,
            source_code=request.script,
            category="Personal",
            is_favorite=False,
            status="draft",
            type=strategy_type,
            python_code=request.python_code,
            compiled_at=datetime.utcnow() if request.python_code else None
        )
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

# --- AI Transpiler Endpoint ---

@router.post("/transpile", response_model=TranspileResponse)
async def transpile_strategy(
    request: TranspileRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Transpile Pine Script to Python using Gemini AI.
    
    This endpoint converts Pine Script DSL code into executable Python code
    that can be used for backtesting and strategy execution.
    """
    try:
        python_code = await transpile_pine_to_python(
            user_id=current_user.id,
            pine_script=request.pine_script,
            db=db
        )
        
        return TranspileResponse(
            python_code=python_code,
            status="success"
        )
    except HTTPException:
        # Re-raise HTTP exceptions from the service
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transpilation failed: {str(e)}"
        )

# --- Activation Endpoints ---
@router.post("/compose", response_model=ComposeResponse)
async def compose_strategy(
    request: ComposeRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Compose multiple indicators into a single trading strategy using AI.
    
    This endpoint uses Gemini AI to intelligently combine multiple indicator
    Python codes into a cohesive trading strategy based on user instructions.
    """
    from app.services.strategy_composer import compose_strategy
    
    try:
        # Validate we have at least 2 indicators
        if len(request.indicator_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 indicators are required for composition"
            )
        
        # Compose the strategy
        python_code = await compose_strategy(
            user_id=current_user.id,
            indicator_ids=request.indicator_ids,
            composition_prompt=request.composition_prompt,
            db=db
        )
        
        # Get indicator names for response
        from sqlalchemy import select
        from app.models.base import Strategy
        
        result = await db.execute(
            select(Strategy.name).where(
                Strategy.id.in_(request.indicator_ids),
                Strategy.user_id == current_user.id
            )
        )
        indicator_names = [row[0] for row in result.all()]
        
        return ComposeResponse(
            python_code=python_code,
            status="success",
            indicators_used=indicator_names
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Strategy composition failed: {str(e)}"
        )
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
        current_capital=activation_in.amount, # Initialize with investment amount
        status="RUNNING",
        risk_per_trade=activation_in.risk_per_trade,
        risk_reward_ratio=activation_in.risk_reward_ratio,
        stop_loss_percent=activation_in.stop_loss_percent,
        use_trailing_stop=activation_in.use_trailing_stop,
        trailing_stop_percent=activation_in.trailing_stop_percent
    )
    
    # Deduct from Balance and Add to Locked Balance
    from app.services.paper_trading import PaperTradingService
    service = PaperTradingService(db)
    account = await service.get_or_create_account(current_user.id)
    
    # Handle None values for balances
    if account.balance is None:
        account.balance = Decimal(0)
    if account.locked_balance is None:
        account.locked_balance = Decimal(0)
    
    if account.balance < Decimal(str(activation_in.amount)):
        raise HTTPException(status_code=400, detail="Insufficient balance to activate strategy")
        
    account.balance -= Decimal(str(activation_in.amount))
    account.locked_balance += Decimal(str(activation_in.amount))
    
    db.add(active_strategy)
    db.add(account) # Add account to session to persist changes
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
        strategy_name=strategy.name,
        risk_per_trade=active_strategy.risk_per_trade,
        risk_reward_ratio=active_strategy.risk_reward_ratio,
        stop_loss_percent=active_strategy.stop_loss_percent,
        use_trailing_stop=active_strategy.use_trailing_stop,
        trailing_stop_percent=active_strategy.trailing_stop_percent
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
            strategy_name=name,
            risk_per_trade=active.risk_per_trade,
            risk_reward_ratio=active.risk_reward_ratio,
            stop_loss_percent=active.stop_loss_percent,
            use_trailing_stop=active.use_trailing_stop,
            trailing_stop_percent=active.trailing_stop_percent
        ))
    return response

@router.delete("/active/{active_id}")
async def delete_active_strategy(
    active_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    print(f"Deleting active strategy: {active_id}")
    result = await db.execute(select(ActiveStrategy).where(ActiveStrategy.id == active_id, ActiveStrategy.user_id == current_user.id))
    active = result.scalars().first()
    if not active:
        print("Active strategy not found")
        raise HTTPException(status_code=404, detail="Active strategy not found")
    
    if active.status == "RUNNING":
        print("Cannot delete running strategy")
        raise HTTPException(status_code=400, detail="Cannot delete a running strategy. Stop it first.")

    await db.delete(active)
    await db.commit()
    print("Active strategy deleted successfully")
    return {"message": "Active strategy deleted"}

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
    
    try:
        if active.status == "RUNNING":
            active.status = "STOPPED"
            
            # Refund capital to balance
            from app.services.paper_trading import PaperTradingService
            service = PaperTradingService(db)
            account = await service.get_or_create_account(current_user.id)
            
            # Refund current_capital (or amount if None)
            refund_amount = Decimal(str(active.current_capital)) if active.current_capital is not None else Decimal(str(active.amount))
            
            # 1. Fetch open positions for this strategy
            pos_res = await db.execute(select(PaperPosition).where(PaperPosition.strategy_id == active.id))
            positions = pos_res.scalars().all()
            
            for pos in positions:
                pos.strategy_id = None
                db.add(pos)
            
            # Handle None values for balances
            if account.locked_balance is None:
                account.locked_balance = Decimal(0)
            if account.balance is None:
                account.balance = Decimal(0)
                
            account.locked_balance -= refund_amount
            account.balance += refund_amount
            db.add(account) # Add account to session to persist changes

        db.add(active)
        await db.commit()
        return {"message": "Strategy stopped"}
    except Exception as e:
        print(f"Error stopping strategy: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to stop strategy: {str(e)}")

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

class BacktestRequest(BaseModel):
    python_code: str  # Changed from script to python_code
    symbol: str
    timeframe: str
    start_date: datetime
    end_date: datetime
    initial_capital: Optional[float] = 10000.0
    take_profit: Optional[float] = 0.0
    stop_loss: Optional[float] = 0.0

class BacktestResult(BaseModel):
    metrics: Dict[str, Any]
    trades: List[Dict[str, Any]]
    equity_curve: List[Dict[str, Any]]
    error: Optional[str] = None

@router.post("/backtest", response_model=BacktestResult)
async def run_backtest(
    request: BacktestRequest,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Run backtest using AI-generated Python code via strategy-engine.
    
    This endpoint:
    1. Fetches historical OHLCV data
    2. Sends Python code + data to strategy-engine for signal generation
    3. Simulates trades based on signals
    4. Calculates performance metrics
    """
    import httpx
    from app.services.market_service import MarketService
    import pandas as pd
    import numpy as np
    
    try:
        # 1. Load OHLCV data from MarketService
        market_service = MarketService()
        try:
            ohlcv_data = await market_service.fetch_historical_data_range(
                request.symbol,
                request.timeframe,
                request.start_date,
                request.end_date
            )
        finally:
            await market_service.close()
        
        if not ohlcv_data:
            return BacktestResult(
                metrics={},
                trades=[],
                equity_curve=[],
                error=f"No market data available for {request.symbol}"
            )
        
        # 2. Prepare data for strategy-engine
        df = pd.DataFrame(ohlcv_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        
        # Convert to dict for JSON (strategy-engine expects this format)
        data_for_engine = {
            'timestamp': [t.isoformat() for t in df.index],
            'open': df['open'].tolist(),
            'high': df['high'].tolist(),
            'low': df['low'].tolist(),
            'close': df['close'].tolist(),
            'volume': df['volume'].tolist()
        }
        
        # 3. Send to strategy-engine for execution
        print(f"[BACKTEST] Sending {len(data_for_engine['timestamp'])} rows to strategy-engine")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://strategy-engine:8001/execute",
                json={
                    "python_code": request.python_code,
                    "data": data_for_engine,
                    "timeout": 10
                },
                timeout=30.0
            )
            response.raise_for_status()
            execution_result = response.json()
        
        print(f"[BACKTEST] Strategy-engine response: success={execution_result.get('success')}, columns={execution_result.get('columns')}")
        
        # 4. Check execution success
        if not execution_result.get('success'):
            error_msg = execution_result.get('message', 'Unknown error')
            print(f"[BACKTEST] Execution failed: {error_msg}")
            return BacktestResult(
                metrics={},
                trades=[],
                equity_curve=[],
                error=f"Strategy execution failed: {error_msg}"
            )
        
        # 5. Process results - get signal column
        result_data = execution_result.get('data', [])
        print(f"[BACKTEST] Received {len(result_data)} data rows")
        if not result_data:
            return BacktestResult(
                metrics={},
                trades=[],
                equity_curve=[],
                error="No data returned from strategy execution"
            )
        
        # Convert to DataFrame
        result_df = pd.DataFrame(result_data)
        print(f"[BACKTEST] Result DataFrame columns: {list(result_df.columns)}")
        
        # Check if 'signal' column exists
        if 'signal' not in result_df.columns:
            print(f"[BACKTEST] Missing 'signal' column!")
            return BacktestResult(
                metrics={"total_trades": 0, "net_profit": 0, "total_return": 0, "win_rate": 0, "max_drawdown": 0},
                trades=[],
                equity_curve=[],
                error="Strategy did not generate any signals (missing 'signal' column)"
            )
        
        # 6. Simulate Trades based on signals
        initial_capital = request.initial_capital
        capital = initial_capital  # Available cash
        position = None  # None, 'LONG'
        entry_price = 0
        entry_time = None
        position_size = 0  # Number of units held
        position_value = 0  # Value at entry
        fee_rate = 0.001  # 0.1% fee
        
        trades = []
        equity_curve = []
        
        # Use close prices from result or original data
        if 'close' in result_df.columns:
            closes = result_df['close'].values
        else:
            closes = df['close'].values
            
        if 'high' in result_df.columns:
            highs = result_df['high'].values
        else:
            highs = df['high'].values
            
        if 'low' in result_df.columns:
            lows = result_df['low'].values
        else:
            lows = df['low'].values
        
        # Get timestamps - convert to list for safe indexing
        if 'timestamp' in result_df.columns:
            timestamps = pd.to_datetime(result_df['timestamp']).tolist()
        else:
            timestamps = df.index.tolist()
        
        signals = result_df['signal'].fillna(0).values
        
        print(f"[BACKTEST] Processing {len(signals)} signals, {len(timestamps)} timestamps")
        
        for i in range(len(signals)):
            current_price = float(closes[i])
            high_price = float(highs[i])
            low_price = float(lows[i])
            timestamp = timestamps[i]
            signal = int(signals[i]) if not pd.isna(signals[i]) else 0
            
            # Check TP/SL for existing position
            if position == 'LONG':
                # Take Profit
                if request.take_profit > 0 and high_price >= entry_price * (1 + request.take_profit/100):
                    exit_price = entry_price * (1 + request.take_profit/100)
                    gross_value = exit_price * position_size
                    fee = gross_value * fee_rate
                    net_proceeds = gross_value - fee
                    pnl = net_proceeds - position_value
                    capital += net_proceeds
                    
                    trades.append({
                        "type": "LONG",
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "entry_time": entry_time.isoformat() if hasattr(entry_time, 'isoformat') else str(entry_time),
                        "exit_time": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
                        "pnl": round(pnl, 2),
                        "pnl_percent": round((exit_price / entry_price - 1) * 100, 2),
                        "size": round(position_size, 6),
                        "status": "Take Profit"
                    })
                    position = None
                    position_size = 0
                    position_value = 0
                    
                # Stop Loss
                elif request.stop_loss > 0 and low_price <= entry_price * (1 - request.stop_loss/100):
                    exit_price = entry_price * (1 - request.stop_loss/100)
                    gross_value = exit_price * position_size
                    fee = gross_value * fee_rate
                    net_proceeds = gross_value - fee
                    pnl = net_proceeds - position_value
                    capital += net_proceeds
                    
                    trades.append({
                        "type": "LONG",
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "entry_time": entry_time.isoformat() if hasattr(entry_time, 'isoformat') else str(entry_time),
                        "exit_time": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
                        "pnl": round(pnl, 2),
                        "pnl_percent": round((exit_price / entry_price - 1) * 100, 2),
                        "size": round(position_size, 6),
                        "status": "Stop Loss"
                    })
                    position = None
                    position_size = 0
                    position_value = 0
            
            # Calculate current equity (cash + position value at current price)
            current_equity = capital
            if position == 'LONG':
                current_equity = capital + (current_price * position_size)
            
            # Only add equity points at intervals to avoid too many data points
            # Add every nth point or if it's the first/last
            if i == 0 or i == len(signals) - 1 or i % max(1, len(signals) // 500) == 0:
                equity_curve.append({
                    "time": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
                    "value": round(current_equity, 2)
                })
            
            # Process signals: 1 = BUY, -1 = SELL/CLOSE
            if signal == 1 and position is None:
                # Open Long - use 95% of capital
                invest_amount = capital * 0.95
                fee = invest_amount * fee_rate
                net_invest = invest_amount - fee
                
                position = 'LONG'
                entry_price = current_price
                entry_time = timestamp
                position_size = net_invest / entry_price
                position_value = net_invest  # What we actually spent
                capital -= invest_amount  # Reduce cash by full amount including fee
                
            elif signal == -1 and position == 'LONG':
                # Close Long
                exit_price = current_price
                gross_value = exit_price * position_size
                fee = gross_value * fee_rate
                net_proceeds = gross_value - fee
                pnl = net_proceeds - position_value
                capital += net_proceeds
                
                trades.append({
                    "type": "LONG",
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(exit_price, 2),
                    "entry_time": entry_time.isoformat() if hasattr(entry_time, 'isoformat') else str(entry_time),
                    "exit_time": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
                    "pnl": round(pnl, 2),
                    "pnl_percent": round((exit_price / entry_price - 1) * 100, 2),
                    "size": round(position_size, 6),
                    "status": "Signal Exit"
                })
                position = None
                position_size = 0
                position_value = 0
        
        # Close any open position at end
        if position == 'LONG':
            exit_price = float(closes[-1])
            gross_value = exit_price * position_size
            fee = gross_value * fee_rate
            net_proceeds = gross_value - fee
            pnl = net_proceeds - position_value
            capital += net_proceeds
            
            trades.append({
                "type": "LONG",
                "entry_price": round(entry_price, 2),
                "exit_price": round(exit_price, 2),
                "entry_time": entry_time.isoformat() if hasattr(entry_time, 'isoformat') else str(entry_time),
                "exit_time": timestamps[-1].isoformat() if hasattr(timestamps[-1], 'isoformat') else str(timestamps[-1]),
                "pnl": round(pnl, 2),
                "pnl_percent": round((exit_price / entry_price - 1) * 100, 2),
                "size": round(position_size, 6),
                "status": "Closed (End of Period)"
            })
            
            # Update final equity
            equity_curve.append({
                "time": timestamps[-1].isoformat() if hasattr(timestamps[-1], 'isoformat') else str(timestamps[-1]),
                "value": round(capital, 2)
            })
        
        # 7. Calculate Metrics
        total_trades = len(trades)
        winning_trades = len([t for t in trades if t['pnl'] > 0])
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        net_profit = capital - initial_capital
        total_return = (net_profit / initial_capital) * 100
        
        # Max Drawdown
        peak = initial_capital
        max_drawdown = 0
        for point in equity_curve:
            val = point['value']
            if val > peak:
                peak = val
            dd = (peak - val) / peak * 100 if peak > 0 else 0
            if dd > max_drawdown:
                max_drawdown = dd
        
        # Sharpe Ratio (simplified)
        if len(equity_curve) > 1:
            returns = []
            for i in range(1, len(equity_curve)):
                prev_val = equity_curve[i-1]['value']
                curr_val = equity_curve[i]['value']
                if prev_val > 0:
                    returns.append((curr_val - prev_val) / prev_val)
            if returns and np.std(returns) > 0:
                sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252)
            else:
                sharpe = 0
        else:
            sharpe = 0
        
        return BacktestResult(
            metrics={
                "initial_capital": initial_capital,
                "final_capital": round(capital, 2),
                "net_profit": round(net_profit, 2),
                "total_return": round(total_return, 2),
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "losing_trades": total_trades - winning_trades,
                "win_rate": round(win_rate, 1),
                "max_drawdown": round(max_drawdown, 2),
                "sharpe_ratio": round(sharpe, 2)
            },
            trades=trades,
            equity_curve=equity_curve,  # Full equity curve - frontend handles display
            error=None
        )
        
    except httpx.HTTPError as e:
        return BacktestResult(
            metrics={},
            trades=[],
            equity_curve=[],
            error=f"Strategy-engine communication error: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return BacktestResult(
            metrics={},
            trades=[],
            equity_curve=[],
            error=str(e)
        )
