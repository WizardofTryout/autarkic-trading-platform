"""
Fleet Management API Endpoints.

Provides REST API for managing AI Trading Agents (the "Fleet").
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
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
    """
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    update_data = agent_update.model_dump(exclude_unset=True)
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
    
    if agent.user_id != current_user.id:
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
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = await manager.pause_agent(agent_id)
    
    return {"status": "paused", "agent_id": str(agent_id)}


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
    manager = AgentFleetManager(db)
    agent = await manager.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await manager.stop_agent(agent_id, release_budget=release_budget)
    
    return {"status": "stopped", "agent_id": str(agent_id)}


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
