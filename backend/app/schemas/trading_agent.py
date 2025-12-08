"""
Pydantic Schemas for AI Trading Fleet.

Defines request/response schemas for TradingAgent and AgentLog models.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal


# ===============================
# AgentLog Schemas
# ===============================

class AgentLogBase(BaseModel):
    """Base schema for agent log entries."""
    status: str = Field(..., description="Agent status at time of log")
    log_text: Optional[str] = Field(None, description="Log message")
    visual_snapshot: Optional[List[dict]] = Field(default=[], description="Visual overlays for chart")
    meta_data: Optional[dict] = Field(default={}, description="Additional metadata")


class AgentLogCreate(AgentLogBase):
    """Schema for creating a new agent log entry."""
    agent_id: UUID


class AgentLogResponse(AgentLogBase):
    """Schema for agent log response."""
    id: UUID
    agent_id: UUID
    timestamp: datetime

    class Config:
        from_attributes = True


# ===============================
# TradingAgent Schemas
# ===============================

class TradingAgentBase(BaseModel):
    """Base schema for trading agents."""
    name: str = Field(..., min_length=1, max_length=50, description="Agent display name")
    symbol: str = Field(..., description="Trading pair, e.g. BTC/USDT")
    mode: str = Field(default="PAPER", description="PAPER or LIVE")
    
    # Budget
    budget: Decimal = Field(default=0, ge=0, description="Allocated budget from account")
    
    # Risk Management
    max_drawdown_percent: Decimal = Field(default=10.0, ge=1, le=50, description="Kill switch threshold %")
    risk_per_trade: Decimal = Field(default=0.01, ge=0.001, le=0.1, description="Risk per trade (0.01 = 1%)")
    min_rr_ratio: Decimal = Field(default=2.0, ge=1.0, le=10.0, description="Minimum risk-reward ratio")
    
    # Multi-Timeframe Strategy
    macro_strategy_id: Optional[UUID] = Field(None, description="Strategy for macro trend (4h)")
    micro_strategy_id: Optional[UUID] = Field(None, description="Strategy for micro entry (15m)")
    macro_timeframe: str = Field(default="4h", description="Higher timeframe for trend")
    micro_timeframe: str = Field(default="15m", description="Lower timeframe for entry")


class TradingAgentCreate(TradingAgentBase):
    """Schema for creating a new trading agent."""
    pass


class TradingAgentUpdate(BaseModel):
    """Schema for updating a trading agent."""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    status: Optional[str] = Field(None, description="Change agent status")
    budget: Optional[Decimal] = Field(None, ge=0)
    max_drawdown_percent: Optional[Decimal] = Field(None, ge=1, le=50)
    risk_per_trade: Optional[Decimal] = Field(None, ge=0.001, le=0.1)
    min_rr_ratio: Optional[Decimal] = Field(None, ge=1.0, le=10.0)
    macro_strategy_id: Optional[UUID] = None
    micro_strategy_id: Optional[UUID] = None
    macro_timeframe: Optional[str] = None
    micro_timeframe: Optional[str] = None


class TradingAgentResponse(TradingAgentBase):
    """Schema for trading agent response."""
    id: UUID
    user_id: UUID
    status: str
    locked_budget: Decimal
    session_pnl: Decimal
    total_trades: int
    winning_trades: int
    active_order_id: Optional[UUID]
    created_at: datetime
    updated_at: Optional[datetime]
    last_signal_at: Optional[datetime]

    class Config:
        from_attributes = True


class TradingAgentListResponse(BaseModel):
    """Schema for list of trading agents."""
    agents: List[TradingAgentResponse]
    total: int


# ===============================
# Fleet Status Schemas (WebSocket)
# ===============================

class FleetStatusMessage(BaseModel):
    """WebSocket message for fleet status updates."""
    agent_id: str
    type: str = Field(..., description="status | thought | trade | error")
    symbol: str
    status: str
    log: Optional[str] = None
    visuals: Optional[List[dict]] = Field(default=[], description="Ghost lines for chart")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    meta: Optional[dict] = None


class AgentApprovalRequest(BaseModel):
    """Schema for approving an agent's proposed trade."""
    approved: bool = Field(..., description="True to approve, False to reject")
    notes: Optional[str] = Field(None, description="Optional notes for audit trail")


class AgentChatRequest(BaseModel):
    """Schema for chatting with an agent."""
    message: str = Field(..., min_length=1, max_length=1000, description="User message to agent")


class AgentChatResponse(BaseModel):
    """Schema for agent chat response."""
    agent_id: UUID
    user_message: str
    agent_response: str
    context: Optional[dict] = Field(None, description="Agent's current context/state")
