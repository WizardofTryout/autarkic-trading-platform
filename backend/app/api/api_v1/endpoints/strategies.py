from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.services.pine_transpiler.parser import parse_pine_script
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
