"""
Fleet Management API Endpoints.

Provides REST API for managing AI Trading Agents (the "Fleet").
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from app.api.deps import get_db, get_current_user
from app.models.base import User
from app.services.fleet_manager import AgentFleetManager
from app.schemas.trading_agent import (
    TradingAgentCreate,
    TradingAgentUpdate,
    TradingAgentResponse,
    TradingAgentListResponse,
    AgentLogResponse,
    AgentApprovalRequest,
    AgentChatRequest,
    AgentChatResponse,
)

router = APIRouter()


@router.get("/budget")
async def get_budget_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get budget overview for the current user.
    
    Returns:
    - balance: Free capital available for manual trading or new agents
    - locked_balance: Capital allocated to active agents
    - total_capital: Total capital (balance + locked_balance)
    """
    from app.models.base import PaperAccount
    from sqlalchemy import select
    
    result = await db.execute(
        select(PaperAccount).where(PaperAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paper account not found"
        )
    
    balance = float(account.balance)
    locked_balance = float(account.locked_balance)
    
    return {
        "balance": balance,
        "locked_balance": locked_balance,
        "total_capital": balance + locked_balance
    }


@router.get("/agents", response_model=TradingAgentListResponse)
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all trading agents for the current user.
    
    Returns list with live status updates for running agents.
    """
    manager = AgentFleetManager(db)
    agents = await manager.get_fleet_status(current_user.id)
    
    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    for agent in agents:
        logger.info(f"🔍 Agent {agent.get('name')}: active_positions={agent.get('active_positions')}, total_trades={agent.get('total_trades')}")
    
    return TradingAgentListResponse(
        agents=[TradingAgentResponse(**a) for a in agents],
        total=len(agents)
    )


@router.post("/agents", response_model=TradingAgentResponse, status_code=status.HTTP_201_CREATED)
async def deploy_agent(
    agent_data: TradingAgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deploy a new trading agent.
    
    Creates the agent and locks budget from paper_account.
    Agent starts in PAUSED state - call /agents/{id}/start to begin.
    """
    manager = AgentFleetManager(db)
    
    try:
        agent = await manager.deploy_agent(
            user_id=current_user.id,
            name=agent_data.name,
            symbol=agent_data.symbol,
            mode=agent_data.mode,
            budget=agent_data.budget,
            max_drawdown_percent=agent_data.max_drawdown_percent,
            risk_per_trade=agent_data.risk_per_trade,
            min_rr_ratio=agent_data.min_rr_ratio,
            leverage=agent_data.leverage,
            margin_mode=agent_data.margin_mode,
            macro_strategy_id=agent_data.macro_strategy_id,
            micro_strategy_id=agent_data.micro_strategy_id,
            macro_timeframe=agent_data.macro_timeframe,
            micro_timeframe=agent_data.micro_timeframe,
        )
        
        return TradingAgentResponse.model_validate(agent)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/agents/{agent_id}", response_model=TradingAgentResponse)
async def get_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific agent by ID."""
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return TradingAgentResponse.model_validate(agent)


@router.patch("/agents/{agent_id}", response_model=TradingAgentResponse)
async def update_agent(
    agent_id: UUID,
    agent_update: TradingAgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update agent configuration.
    
    Can update: name, risk settings, strategies, status.
    If budget changes, adjusts locked_balance accordingly.
    """
    from decimal import Decimal
    from app.models.base import PaperAccount
    from sqlalchemy import update as sql_update
    
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if budget is being changed
    update_data = agent_update.model_dump(exclude_unset=True)
    old_budget = agent.budget
    new_budget = update_data.get('budget', old_budget)
    
    # If budget changes, adjust paper_account locked_balance
    if new_budget != old_budget and agent.mode == "PAPER":
        budget_diff = Decimal(str(new_budget)) - Decimal(str(old_budget))
        
        # Check if user has enough available balance for increase
        if budget_diff > 0:
            result = await db.execute(
                select(PaperAccount).where(PaperAccount.user_id == current_user.id)
            )
            account = result.scalar_one_or_none()
            if not account or account.balance < budget_diff:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient available balance. Need ${budget_diff} more."
                )
        
        # Adjust locked_balance and balance
        await db.execute(
            sql_update(PaperAccount)
            .where(PaperAccount.user_id == current_user.id)
            .values(
                balance=PaperAccount.balance - budget_diff,  # Decrease/increase balance
                locked_balance=PaperAccount.locked_balance + budget_diff  # Increase/decrease locked
            )
        )
        
        # Update agent's locked_budget to match
        update_data['locked_budget'] = new_budget
    
    # Update agent fields
    for field, value in update_data.items():
        setattr(agent, field, value)
    
    await db.commit()
    await db.refresh(agent)
    
    return TradingAgentResponse.model_validate(agent)


@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an agent.
    
    Stops the agent if running, releases budget, and deletes all logs.
    """
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Allow deletion if user_id is NULL (legacy agents) or matches current user
    if agent.user_id is not None and agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await manager.delete_agent(agent_id)


# ==================== Agent Control Endpoints ====================

@router.post("/agents/{agent_id}/start")
async def start_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a paused agent.
    
    Begins the analysis loop and starts scanning for signals.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        manager = AgentFleetManager(db)
        agent = await manager.get_agent(agent_id)
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        success = await manager.start_agent(agent_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to start agent"
            )
        
        return {"status": "started", "agent_id": str(agent_id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting agent {agent_id}: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start agent: {str(e)}"
        )


@router.post("/agents/{agent_id}/pause")
async def pause_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pause a running agent.
    
    Stops the analysis loop but keeps budget locked.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        manager = AgentFleetManager(db)
        agent = await manager.get_agent(agent_id)
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        success = await manager.pause_agent(agent_id)
        
        return {"status": "paused", "agent_id": str(agent_id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error pausing agent {agent_id}: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pause agent: {str(e)}"
        )


@router.post("/agents/{agent_id}/stop")
async def stop_agent(
    agent_id: UUID,
    release_budget: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stop an agent completely.
    
    Optionally releases budget back to paper_account.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        manager = AgentFleetManager(db)
        agent = await manager.get_agent(agent_id)
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        await manager.stop_agent(agent_id, release_budget=release_budget)
        
        return {"status": "stopped", "agent_id": str(agent_id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping agent {agent_id}: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop agent: {str(e)}"
        )


@router.post("/agents/{agent_id}/approve")
async def approve_proposal(
    agent_id: UUID,
    approval: AgentApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve or reject an agent's trade proposal.
    
    This is the Human-in-the-Loop checkpoint.
    Only valid when agent status is AWAITING_APPROVAL.
    """
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = await manager.approve_proposal(
        agent_id,
        approved=approval.approved,
        notes=approval.notes
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent not awaiting approval"
        )
    
    return {
        "status": "approved" if approval.approved else "rejected",
        "agent_id": str(agent_id)
    }


# ==================== Agent Logs ====================

@router.get("/agents/{agent_id}/logs", response_model=List[AgentLogResponse])
async def get_agent_logs(
    agent_id: UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get recent logs for an agent.
    
    Returns log entries with visual snapshots for chart rendering.
    """
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = await manager.get_agent_logs(agent_id, limit=limit, offset=offset)
    
    return [AgentLogResponse.model_validate(log) for log in logs]


# ==================== Agent Chat ====================

@router.post("/agents/{agent_id}/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    agent_id: UUID,
    chat: AgentChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chat with an agent about its decisions.
    
    Uses Gemini AI with the agent's current context to answer questions
    like "Why are you waiting?" or "What's your analysis?".
    """
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get agent context
    context = {
        "name": agent.name,
        "symbol": agent.symbol,
        "status": agent.status,
        "session_pnl": float(agent.session_pnl),
        "macro_timeframe": agent.macro_timeframe,
        "micro_timeframe": agent.micro_timeframe,
    }
    
    # TODO: Integrate with Gemini for intelligent responses
    # For now, return a placeholder response
    response_text = f"I am {agent.name}, currently {agent.status}. Analyzing {agent.symbol} on {agent.macro_timeframe}/{agent.micro_timeframe} timeframes."
    
    return AgentChatResponse(
        agent_id=agent_id,
        user_message=chat.message,
        agent_response=response_text,
        context=context
    )

# --- Backtest Snapshot Endpoint ---

@router.post("/agents/{agent_id}/backtest_snapshot")
async def backtest_snapshot(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run a quick backtest (snapshot) for the agent's active strategies.
    Returns historical signals for visualization on the cockpit charts.
    """
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    from app.services.market_service import MarketService
    from app.models.base import Strategy
    from sqlalchemy.future import select
    import httpx
    import pandas as pd
    from datetime import datetime, timedelta

    results = {
        "macro_signals": [],
        "micro_signals": []
    }

    # Helper to run backtest for a specific strategy/timeframe
    async def run_single_backtest(strategy_id: UUID, timeframe: str, symbol: str) -> List[dict]:
        if not strategy_id:
            return []
            
        # 1. Fetch Strategy Code
        stmt = select(Strategy).where(Strategy.id == strategy_id)
        res = await db.execute(stmt)
        strategy = res.scalars().first()
        if not strategy or not strategy.python_code:
            return []

        # 2. Fetch Data (last 300 candles)
        market_service = MarketService()
        try:
            # Approx lookback based on timeframe
            # simplified: just get last 300 items
            # The strategy execution endpoint handles limit? 
            # We'll use fetch_historical_data_range or similar if available, 
            # but market_service.get_ohlcv(symbol, timeframe, limit=300) is standard.
            ohlcv = await market_service.get_ohlcv(symbol, timeframe, limit=300)
        finally:
            await market_service.close()
            
        if not ohlcv:
            return []

        # 3. Format for Engine
        df = pd.DataFrame(ohlcv)
        # Ensure timestamp is string for JSON
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        data_for_engine = {
            'timestamp': [t.isoformat() for t in df['timestamp']],
            'open': df['open'].tolist(),
            'high': df['high'].tolist(),
            'low': df['low'].tolist(),
            'close': df['close'].tolist(),
            'volume': df['volume'].tolist()
        }

        # 4. Call Engine
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://strategy-engine:8001/execute",
                    json={
                        "python_code": strategy.python_code,
                        "data": data_for_engine,
                        "timeout": 10
                    },
                    timeout=15.0
                )
                if response.status_code != 200:
                    print(f"Engine failed: {response.text}")
                    return []
                exec_result = response.json()
        except Exception as e:
            print(f"Backtest snapshot RPC error: {e}")
            return []

        if not exec_result.get('success'):
            return []

        # 5. Extract Signals
        # The engine returns a DataFrame-like dictionary in 'data'
        # We look for 'signal' column (1, -1, 0)
        exec_data = exec_result.get('data', [])
        if not exec_data:
            return []
            
        result_df = pd.DataFrame(exec_data)
        if 'signal' not in result_df.columns:
            return []
            
        signals = []
        # result_df should match length of data_for_engine
        # We assume indices align. result_df usually has 'timestamp' col too.
        
        for i, row in result_df.iterrows():
            sig = row.get('signal', 0)
            if sig != 0:
                signals.append({
                    "time": row.get('timestamp'), # ISO string
                    "type": "buy" if sig > 0 else "sell",
                    "price": row.get('close'),
                    "color": "#00ff00" if sig > 0 else "#ff0000",
                    "label": "B" if sig > 0 else "S"
                })
        return signals

    # Run for Macro
    if agent.macro_strategy_id:
        results["macro_signals"] = await run_single_backtest(
            agent.macro_strategy_id, 
            agent.macro_timeframe, 
            agent.symbol
        )

    # Run for Micro
    if agent.micro_strategy_id:
        results["micro_signals"] = await run_single_backtest(
            agent.micro_strategy_id, 
            agent.micro_timeframe, 
            agent.symbol
        )

    return results
