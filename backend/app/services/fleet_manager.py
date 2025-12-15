"""
Agent Fleet Manager - Orchestrates multiple trading agents.

This service manages a fleet of TradingAgentInstance objects,
handles their lifecycle, and coordinates WebSocket broadcasting.
"""

import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional, List, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.base import TradingAgent, AgentLog, PaperAccount, Strategy
from app.services.trading_agent_instance import TradingAgentInstance, AgentStatus
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


class AgentFleetManager:
    """
    Manages a fleet of trading agents for a user.
    
    Responsibilities:
    - Start/Stop/Pause individual agents
    - Track all running agent instances
    - Handle budget locking from paper_account
    - Broadcast updates via Redis Pub/Sub
    - Persist agent state to database
    """
    
    # Singleton-style registry of active agents
    _active_agents: Dict[UUID, TradingAgentInstance] = {}
    
    # Redis channel for fleet updates
    FLEET_CHANNEL = "fleet_updates"
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._redis = None  # Will be initialized on first use
    
    async def _get_redis(self):
        """Get Redis connection for pub/sub."""
        if self._redis is None:
            import redis.asyncio as redis
            import os
            redis_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
            self._redis = redis.from_url(redis_url)
        return self._redis

    async def restore_active_agents(self):
        """
        Restore running agents from database on server startup.
        
        Checks for agents with running status (SCANNING, ACTIVE, IN_POSITION, AWAITING_APPROVAL)
        and re-initializes them in memory.
        """
        try:
            # Fetch all agents that should be running
            stmt = select(TradingAgent).where(
                TradingAgent.status.in_([
                    AgentStatus.SCANNING,
                    AgentStatus.ACTIVE,
                    AgentStatus.IN_POSITION,
                    AgentStatus.AWAITING_APPROVAL,
                    # Note: ERROR or STOPPED agents are not auto-restarted
                ])
            )
            result = await self.db.execute(stmt)
            agents = result.scalars().all()
            
            logger.info(f"Restoring {len(agents)} active agents from database...")
            
            for agent in agents:
                try:
                    # Create instance if not exists
                    if agent.id not in self._active_agents:
                        instance = TradingAgentInstance(
                            agent_id=agent.id,
                            user_id=agent.user_id,
                            symbol=agent.symbol,
                            mode=agent.mode,
                            budget=agent.budget,
                            max_drawdown_percent=agent.max_drawdown_percent,
                            risk_per_trade=agent.risk_per_trade,
                            min_rr_ratio=agent.min_rr_ratio,
                            macro_strategy_id=agent.macro_strategy_id,
                            micro_strategy_id=agent.micro_strategy_id,
                            macro_timeframe=agent.macro_timeframe,
                            micro_timeframe=agent.micro_timeframe,
                        )
                        
                        # Load previous state
                        instance.status = AgentStatus(agent.status)
                        
                        # Restore active position check is done in get_state, but logic relies on resume
                        # We need to manually set running flag and start loop WITHOUT resetting status
                        await instance.resume()
                        
                        self._active_agents[agent.id] = instance
                        logger.info(f"Restored agent {agent.name} ({agent.id})")
                        
                except Exception as e:
                    logger.error(f"Failed to restore agent {agent.id}: {e}")
                    
        except Exception as e:
            logger.error(f"Error checking for active agents to restore: {e}")
    
    async def deploy_agent(
        self,
        user_id: UUID,
        name: str,
        symbol: str,
        mode: str = "PAPER",
        budget: Decimal = Decimal("100"),
        max_drawdown_percent: Decimal = Decimal("10.0"),
        risk_per_trade: Decimal = Decimal("0.01"),
        min_rr_ratio: Decimal = Decimal("2.0"),
        macro_strategy_id: Optional[UUID] = None,
        micro_strategy_id: Optional[UUID] = None,
        macro_timeframe: str = "4h",
        micro_timeframe: str = "15m",
    ) -> TradingAgent:
        """
        Deploy a new trading agent.
        
        1. Validates budget availability
        2. Creates database record
        3. Locks budget from paper_account
        4. Starts the agent instance
        """
        # Validate budget availability
        if mode == "PAPER":
            available = await self._check_available_budget(user_id, budget)
            if not available:
                raise ValueError("Insufficient available balance for agent budget")
            
            # Lock budget
            await self._lock_budget(user_id, budget)
        
        # Get strategy code if provided
        macro_code = None
        micro_code = None
        
        if macro_strategy_id:
            macro_strategy = await self.db.get(Strategy, macro_strategy_id)
            if macro_strategy:
                macro_code = macro_strategy.python_code
        
        if micro_strategy_id:
            micro_strategy = await self.db.get(Strategy, micro_strategy_id)
            if micro_strategy:
                micro_code = micro_strategy.python_code
        
        # Create database record
        agent = TradingAgent(
            user_id=user_id,
            name=name,
            symbol=symbol,
            mode=mode,
            status=AgentStatus.PAUSED.value,
            budget=budget,
            locked_budget=budget,
            max_drawdown_percent=max_drawdown_percent,
            risk_per_trade=risk_per_trade,
            min_rr_ratio=min_rr_ratio,
            macro_strategy_id=macro_strategy_id,
            micro_strategy_id=micro_strategy_id,
            macro_timeframe=macro_timeframe,
            micro_timeframe=micro_timeframe,
        )
        
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        
        logger.info(f"Deployed new agent: {agent.id} ({name}) for {symbol}")
        
        return agent
    
    async def start_agent(self, agent_id: UUID) -> bool:
        """
        Start a paused agent.
        
        Creates the TradingAgentInstance and begins the analysis loop.
        """
        # Get agent from database
        agent = await self.db.get(TradingAgent, agent_id)
        if not agent:
            logger.error(f"Agent {agent_id} not found")
            return False
        
        # If an instance exists (paused), resume it instead of failing
        if agent_id in self._active_agents:
            instance = self._active_agents[agent_id]
            await instance.start()
            await self._update_agent_status(agent_id, AgentStatus.SCANNING.value)
            return True
        
        # Get strategy code
        macro_code = None
        micro_code = None
        
        if agent.macro_strategy_id:
            macro_strategy = await self.db.get(Strategy, agent.macro_strategy_id)
            macro_code = macro_strategy.python_code if macro_strategy else None
        
        if agent.micro_strategy_id:
            micro_strategy = await self.db.get(Strategy, agent.micro_strategy_id)
            micro_code = micro_strategy.python_code if micro_strategy else None
        
        # Create agent instance
        instance = TradingAgentInstance(
            agent_id=agent.id,
            user_id=agent.user_id,
            symbol=agent.symbol,
            mode=agent.mode,
            budget=agent.budget,
            max_drawdown_percent=agent.max_drawdown_percent,
            risk_per_trade=agent.risk_per_trade,
            min_rr_ratio=agent.min_rr_ratio,
            macro_strategy_code=macro_code,
            micro_strategy_code=micro_code,
            macro_strategy_id=agent.macro_strategy_id,
            micro_strategy_id=agent.micro_strategy_id,
            macro_timeframe=agent.macro_timeframe,
            micro_timeframe=agent.micro_timeframe,
            on_status_change=self._on_agent_status_change,
            on_log_entry=self._on_agent_log,
            on_update=self._on_agent_update
        )
        
        # Store and start
        self._active_agents[agent_id] = instance
        await instance.start()
        
        # Update database status
        await self._update_agent_status(agent_id, AgentStatus.SCANNING.value)
        
        return True
    
    async def pause_agent(self, agent_id: UUID) -> bool:
        """Pause a running agent."""
        if agent_id not in self._active_agents:
            logger.warning(f"Agent {agent_id} not running")
            return False
        
        instance = self._active_agents[agent_id]
        await instance.pause()
        
        # Update database
        await self._update_agent_status(agent_id, AgentStatus.PAUSED.value)
        
        return True
    
    async def stop_agent(self, agent_id: UUID, release_budget: bool = True) -> bool:
        """
        Stop an agent completely.
        
        Optionally releases the locked budget back to paper_account.
        """
        # Stop running instance if exists
        if agent_id in self._active_agents:
            instance = self._active_agents[agent_id]
            await instance.stop()
            del self._active_agents[agent_id]
        
        # Get agent from database
        agent = await self.db.get(TradingAgent, agent_id)
        if not agent:
            return False
        
        # Release budget if requested
        if release_budget and agent.mode == "PAPER":
            await self._release_budget(agent.user_id, agent.locked_budget)
        
        # Update database
        await self._update_agent_status(agent_id, AgentStatus.STOPPED.value)
        
        return True
    
    async def delete_agent(self, agent_id: UUID) -> bool:
        """Delete an agent and all its logs."""
        # Stop first if running
        await self.stop_agent(agent_id, release_budget=True)
        
        # Delete from database
        agent = await self.db.get(TradingAgent, agent_id)
        if agent:
            await self.db.delete(agent)
            await self.db.commit()
            logger.info(f"Deleted agent {agent_id}")
            return True
        
        return False
    
    async def approve_proposal(self, agent_id: UUID, approved: bool, notes: Optional[str] = None) -> bool:
        """Approve or reject an agent's trade proposal."""
        if agent_id not in self._active_agents:
            logger.warning(f"Agent {agent_id} not running")
            return False
        
        instance = self._active_agents[agent_id]
        return await instance.approve_proposal(approved, notes)
    
    async def get_fleet_status(self, user_id: UUID) -> List[Dict]:
        """Get status of all agents for a user."""
        result = await self.db.execute(
            select(TradingAgent).where(TradingAgent.user_id == user_id)
        )
        agents = result.scalars().all()
        
        status_list = []
        for agent in agents:
            agent_data = {
                "id": str(agent.id),
                "name": agent.name,
                "symbol": agent.symbol,
                "mode": agent.mode,
                "status": agent.status,
                "budget": float(agent.budget),
                "session_pnl": float(agent.session_pnl),
                "total_trades": agent.total_trades,
                "winning_trades": agent.winning_trades,
                "max_drawdown_percent": float(agent.max_drawdown_percent),
                "macro_timeframe": agent.macro_timeframe,
                "micro_timeframe": agent.micro_timeframe,
                "macro_strategy_id": str(agent.macro_strategy_id) if agent.macro_strategy_id else None,
                "micro_strategy_id": str(agent.micro_strategy_id) if agent.micro_strategy_id else None,
                "created_at": agent.created_at.isoformat() if agent.created_at else None,
            }
            
            # Add live state if running
            if agent.id in self._active_agents:
                instance = self._active_agents[agent.id]
                agent_data.update(await instance.get_state())
            
            status_list.append(agent_data)
        
        return status_list
    
    async def get_agent(self, agent_id: UUID) -> Optional[TradingAgent]:
        """Get a single agent by ID."""
        return await self.db.get(TradingAgent, agent_id)
    
    async def get_agent_logs(
        self,
        agent_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[AgentLog]:
        """Get recent logs for an agent."""
        result = await self.db.execute(
            select(AgentLog)
            .where(AgentLog.agent_id == agent_id)
            .order_by(AgentLog.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()
    
    # ==================== Private Methods ====================
    
    async def _check_available_budget(self, user_id: UUID, required: Decimal) -> bool:
        """Check if user has sufficient available balance."""
        result = await self.db.execute(
            select(PaperAccount).where(PaperAccount.user_id == user_id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            return False
        
        available = account.balance - account.locked_balance
        return available >= required
    
    async def _lock_budget(self, user_id: UUID, amount: Decimal):
        """Lock budget in paper_account for agent use."""
        await self.db.execute(
            update(PaperAccount)
            .where(PaperAccount.user_id == user_id)
            .values(locked_balance=PaperAccount.locked_balance + amount)
        )
        await self.db.commit()
    
    async def _release_budget(self, user_id: UUID, amount: Decimal):
        """Release locked budget back to paper_account."""
        await self.db.execute(
            update(PaperAccount)
            .where(PaperAccount.user_id == user_id)
            .values(locked_balance=PaperAccount.locked_balance - amount)
        )
        await self.db.commit()
    
    async def _update_agent_status(self, agent_id: UUID, status: str):
        """Update agent status in database using a new session."""
        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(
                    update(TradingAgent)
                    .where(TradingAgent.id == agent_id)
                    .values(status=status, updated_at=datetime.utcnow())
                )
                await session.commit()
    
    async def _on_agent_status_change(self, agent_id: UUID, status: AgentStatus):
        """Callback when an agent's status changes."""
        await self._update_agent_status(agent_id, status.value)
        
        # Get full state if agent is active
        agent_data = {}
        if agent_id in self._active_agents:
            agent_data = await self._active_agents[agent_id].get_state()
            
        await self._broadcast_update({
            "type": "agent_update",
            "agent_id": str(agent_id),
            "data": agent_data,
            "timestamp": datetime.utcnow().isoformat()
        })
        
    async def _on_agent_update(self, agent_id: UUID):
        """Handle periodic updates from agent (e.g. PnL updates)."""
        # Get full state
        agent_data = {}
        if agent_id in self._active_agents:
            agent_data = await self._active_agents[agent_id].get_state()
            
        await self._broadcast_update({
            "type": "agent_update",
            "agent_id": str(agent_id),
            "data": agent_data,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def _on_agent_log(self, log_entry: Dict):
        """Callback when an agent creates a log entry using a new session."""
        # Save to database with a new session
        agent_id = UUID(log_entry["agent_id"])
        
        async with AsyncSessionLocal() as session:
            async with session.begin():
                db_log = AgentLog(
                    agent_id=agent_id,
                    status=log_entry["status"],
                    log_text=log_entry.get("log_text"),
                    visual_snapshot=log_entry.get("visual_snapshot", []),
                    meta_data=log_entry.get("meta_data", {}),
                )
                session.add(db_log)
                await session.commit()
        
        # Broadcast to WebSocket
        await self._broadcast_update({
            "type": "log",
            **log_entry,
        })
    
    async def _broadcast_update(self, message: Dict):
        """Broadcast update to Redis for WebSocket distribution."""
        try:
            redis = await self._get_redis()
            import json
            await redis.publish(self.FLEET_CHANNEL, json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to broadcast update: {e}")
