"""
Trading Agent Instance - Core execution engine for a single trading agent.

Each instance manages one trading pair and executes multi-timeframe analysis
using configured strategies. Supports both PAPER and LIVE trading modes.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID
from enum import Enum

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    """Status states for a trading agent."""
    PAUSED = "PAUSED"
    SCANNING = "SCANNING"
    PROPOSING = "PROPOSING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    ACTIVE = "ACTIVE"
    IN_POSITION = "IN_POSITION"
    COOLDOWN = "COOLDOWN"
    STOPPED = "STOPPED"
    ERROR = "ERROR"


class SignalType(str, Enum):
    """Signal types from strategy execution."""
    LONG = "LONG"
    SHORT = "SHORT"
    NEUTRAL = "NEUTRAL"


class TradingAgentInstance:
    """
    Manages the lifecycle of a single trading agent.
    
    Responsibilities:
    - Fetch multi-timeframe data (macro + micro)
    - Execute strategy code on both timeframes
    - Calculate position sizing based on risk parameters
    - Generate visual proposals (Ghost Lines)
    - Execute trades via Paper or Live routing
    """
    
    def __init__(
        self,
        agent_id: UUID,
        user_id: UUID,
        symbol: str,
        mode: str = "PAPER",
        budget: Decimal = Decimal("0"),
        max_drawdown_percent: Decimal = Decimal("10.0"),
        risk_per_trade: Decimal = Decimal("0.01"),
        min_rr_ratio: Decimal = Decimal("2.0"),
        macro_strategy_code: Optional[str] = None,
        micro_strategy_code: Optional[str] = None,
        macro_timeframe: str = "4h",
        micro_timeframe: str = "15m",
        on_status_change: Optional[callable] = None,
        on_log_entry: Optional[callable] = None,
    ):
        self.agent_id = agent_id
        self.user_id = user_id
        self.symbol = symbol
        self.mode = mode
        self.budget = budget
        self.max_drawdown_percent = max_drawdown_percent
        self.risk_per_trade = risk_per_trade
        self.min_rr_ratio = min_rr_ratio
        self.macro_strategy_code = macro_strategy_code
        self.micro_strategy_code = micro_strategy_code
        self.macro_timeframe = macro_timeframe
        self.micro_timeframe = micro_timeframe
        
        # Callbacks for external communication
        self._on_status_change = on_status_change
        self._on_log_entry = on_log_entry
        
        # Runtime state
        self._status = AgentStatus.PAUSED
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._session_pnl = Decimal("0")
        self._total_trades = 0
        self._winning_trades = 0
        self._current_proposal: Optional[Dict] = None
        self._last_signal_at: Optional[datetime] = None
        self._cooldown_until: Optional[datetime] = None
        
        # Data buffers
        self._macro_data: Optional[Any] = None
        self._micro_data: Optional[Any] = None
    
    @property
    def status(self) -> AgentStatus:
        return self._status
    
    @status.setter
    def status(self, value: AgentStatus):
        old_status = self._status
        self._status = value
        if self._on_status_change and old_status != value:
            asyncio.create_task(self._on_status_change(self.agent_id, value))
    
    async def start(self):
        """Start the agent's analysis loop."""
        if self._running:
            logger.warning(f"Agent {self.agent_id} already running")
            return
        
        self._running = True
        self.status = AgentStatus.SCANNING
        self._task = asyncio.create_task(self._run_loop())
        await self._log("Agent started", {"mode": self.mode, "symbol": self.symbol})
    
    async def pause(self):
        """Pause the agent (can be resumed)."""
        self._running = False
        self.status = AgentStatus.PAUSED
        if self._task:
            self._task.cancel()
        await self._log("Agent paused")
    
    async def stop(self):
        """Stop the agent completely."""
        self._running = False
        self.status = AgentStatus.STOPPED
        if self._task:
            self._task.cancel()
        await self._log("Agent stopped")
    
    async def approve_proposal(self, approved: bool = True, notes: Optional[str] = None):
        """
        Handle user approval/rejection of a proposed trade.
        
        This is the Human-in-the-Loop checkpoint.
        """
        if self.status != AgentStatus.AWAITING_APPROVAL:
            logger.warning(f"Agent {self.agent_id} not awaiting approval")
            return False
        
        if approved and self._current_proposal:
            await self._log(f"Proposal approved: {notes or 'No notes'}")
            self.status = AgentStatus.ACTIVE
            await self._execute_trade(self._current_proposal)
        else:
            await self._log(f"Proposal rejected: {notes or 'No notes'}")
            self._current_proposal = None
            self.status = AgentStatus.SCANNING
        
        return True
    
    async def _run_loop(self):
        """
        Main analysis loop - runs until paused/stopped.
        
        Loop frequency: Every 30 seconds
        """
        while self._running:
            try:
                # Check if in cooldown
                if self._cooldown_until and datetime.utcnow() < self._cooldown_until:
                    await asyncio.sleep(10)
                    continue
                
                # Check kill switch
                if await self._check_kill_switch():
                    self.status = AgentStatus.STOPPED
                    await self._log("Kill switch activated - max drawdown exceeded")
                    break
                
                # Skip if not in scanning mode
                if self.status not in [AgentStatus.SCANNING, AgentStatus.ACTIVE]:
                    await asyncio.sleep(5)
                    continue
                
                # Step 1: Fetch multi-timeframe data
                await self._fetch_market_data()
                
                # Step 2: Analyze macro trend
                macro_signal = await self._analyze_macro()
                
                # Step 3: Analyze micro entry
                micro_signal = await self._analyze_micro()
                
                # Step 4: Synthesize signals
                await self._synthesize_signals(macro_signal, micro_signal)
                
                # Calculate sleep time based on micro timeframe
                # default to 30s if not specified or unrecognized
                sleep_seconds = 30
                
                if self.micro_timeframe == '1s':
                    sleep_seconds = 1
                elif self.micro_timeframe == '1m':
                    sleep_seconds = 5
                elif self.micro_timeframe == '5m':
                    sleep_seconds = 30
                elif self.micro_timeframe == '15m':
                    sleep_seconds = 60
                
                # Wait before next iteration
                await asyncio.sleep(sleep_seconds)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Agent {self.agent_id} error: {e}")
                await self._log(f"Error: {str(e)}", {"error": True})
                self.status = AgentStatus.ERROR
                await asyncio.sleep(60)  # Wait before retry
    
    async def _fetch_market_data(self):
        """Fetch OHLCV data for both timeframes."""
        from app.services.market_service import MarketService
        
        market_service = MarketService()
        try:
            # Fetch macro timeframe data (for trend analysis - need more history)
            await self._log(f"Fetching data: {self.macro_timeframe} + {self.micro_timeframe}")
            
            self._macro_data = await market_service.get_ohlcv(
                self.symbol, 
                self.macro_timeframe, 
                limit=200  # 200 candles for pattern recognition
            )
            
            # Fetch micro timeframe data (for entry signals)
            self._micro_data = await market_service.get_ohlcv(
                self.symbol, 
                self.micro_timeframe, 
                limit=200
            )
            
            logger.info(f"Agent {self.agent_id}: Fetched {len(self._macro_data or [])} macro candles, {len(self._micro_data or [])} micro candles")
            
        except Exception as e:
            logger.error(f"Agent {self.agent_id}: Error fetching market data: {e}")
            raise
        finally:
            await market_service.close()
    
    async def _analyze_macro(self) -> SignalType:
        """
        Analyze the macro timeframe for trend direction.
        
        Returns: LONG, SHORT, or NEUTRAL
        """
        if not self.macro_strategy_code:
            await self._log(f"No macro strategy assigned. Skipping macro analysis.")
            return SignalType.NEUTRAL
        
        if not self._macro_data:
            return SignalType.NEUTRAL
        
        await self._log(f"Analyzing {self.macro_timeframe} trend...")
        signal = await self._execute_strategy_code(self.macro_strategy_code, self._macro_data)
        
        if signal:
            await self._log(f"Macro signal: {signal.value}")
        
        return signal
    
    async def _analyze_micro(self) -> SignalType:
        """
        Analyze the micro timeframe for entry signals.
        
        Returns: LONG, SHORT, or NEUTRAL
        """
        if not self.micro_strategy_code:
            await self._log(f"No micro strategy assigned. Skipping micro analysis.")
            return SignalType.NEUTRAL
        
        if not self._micro_data:
            return SignalType.NEUTRAL
        
        await self._log(f"Analyzing {self.micro_timeframe} entry...")
        signal = await self._execute_strategy_code(self.micro_strategy_code, self._micro_data)
        
        if signal:
            await self._log(f"Micro signal: {signal.value}")
        
        return signal
    
    async def _execute_strategy_code(self, python_code: str, ohlcv_data: list) -> SignalType:
        """
        Execute strategy code via the strategy-engine microservice.
        
        Args:
            python_code: Python strategy code to execute
            ohlcv_data: List of OHLCV dictionaries
            
        Returns:
            SignalType based on the latest signal from strategy execution
        """
        import httpx
        
        if not ohlcv_data or len(ohlcv_data) < 10:
            logger.warning(f"Agent {self.agent_id}: Insufficient data for analysis ({len(ohlcv_data or [])} candles)")
            return SignalType.NEUTRAL
        
        try:
            # Convert OHLCV data to dict format for strategy-engine
            data_dict = {
                'timestamp': [candle['timestamp'].isoformat() if hasattr(candle['timestamp'], 'isoformat') else str(candle['timestamp']) for candle in ohlcv_data],
                'open': [float(candle['open']) for candle in ohlcv_data],
                'high': [float(candle['high']) for candle in ohlcv_data],
                'low': [float(candle['low']) for candle in ohlcv_data],
                'close': [float(candle['close']) for candle in ohlcv_data],
                'volume': [float(candle['volume']) for candle in ohlcv_data],
            }
            
            # Call strategy-engine microservice
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "http://strategy-engine:8001/execute",
                    json={
                        "python_code": python_code,
                        "data": data_dict,
                        "timeout": 5
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"Agent {self.agent_id}: Strategy engine error: {response.text}")
                    return SignalType.NEUTRAL
                
                result = response.json()
                
                if not result.get("success"):
                    logger.error(f"Agent {self.agent_id}: Strategy execution failed: {result.get('error')}")
                    return SignalType.NEUTRAL
                
                # Parse signals from result
                # The strategy code should output a 'signal' column with values like 'BUY', 'SELL', 'LONG', 'SHORT'
                data = result.get("data", [])
                
                if not data:
                    return SignalType.NEUTRAL
                
                # Get the most recent signal
                last_row = data[-1] if data else {}
                
                # Check for signal column (various naming conventions)
                signal_value = (
                    last_row.get('signal') or 
                    last_row.get('Signal') or 
                    last_row.get('action') or 
                    last_row.get('Action') or
                    last_row.get('entry') or
                    last_row.get('Entry')
                )
                
                if signal_value:
                    signal_str = str(signal_value).upper()
                    
                    if signal_str in ['BUY', 'LONG', '1', '1.0', 'TRUE']:
                        logger.info(f"Agent {self.agent_id}: Detected LONG signal from strategy")
                        return SignalType.LONG
                    elif signal_str in ['SELL', 'SHORT', '-1', '-1.0']:
                        logger.info(f"Agent {self.agent_id}: Detected SHORT signal from strategy")
                        return SignalType.SHORT
                
                return SignalType.NEUTRAL
                
        except httpx.ConnectError:
            logger.error(f"Agent {self.agent_id}: Cannot connect to strategy-engine service")
            await self._log("Error: Cannot connect to strategy-engine")
            return SignalType.NEUTRAL
        except Exception as e:
            logger.error(f"Agent {self.agent_id}: Strategy execution error: {e}")
            return SignalType.NEUTRAL
    
    async def _synthesize_signals(self, macro: SignalType, micro: SignalType):
        """
        Combine macro and micro signals to generate trade proposal.
        
        Rules:
        - Macro LONG + Micro LONG = Propose Long
        - Macro SHORT + Micro SHORT = Propose Short
        - Counter-trend entries are ignored
        """
        # Only proceed if signals align
        if macro == SignalType.LONG and micro == SignalType.LONG:
            await self._create_proposal("LONG")
        elif macro == SignalType.SHORT and micro == SignalType.SHORT:
            await self._create_proposal("SHORT")
        else:
            # No action - signals don't align
            if macro != SignalType.NEUTRAL or micro != SignalType.NEUTRAL:
                await self._log(f"Signal mismatch. Macro: {macro.value}, Micro: {micro.value}")
    
    async def _create_proposal(self, side: str):
        """
        Create a trade proposal with Entry, SL, TP levels.
        
        Generates visual "Ghost Lines" for the chart.
        """
        # TODO: Calculate actual entry, SL, TP from strategy
        # Use the latest close price from micro data as current price
        last_candle = self._micro_data[-1] if self._micro_data else {}
        price_val = last_candle.get('close', 0)
        current_price = Decimal(str(price_val))
        
        if current_price <= 0:
            await self._log("Error: Invalid price data for proposal")
            return
        
        # Calculate SL/TP based on risk parameters
        sl_distance = current_price * self.risk_per_trade
        tp_distance = sl_distance * self.min_rr_ratio
        
        if side == "LONG":
            entry = current_price
            stop_loss = entry - sl_distance
            take_profit = entry + tp_distance
        else:
            entry = current_price
            stop_loss = entry + sl_distance
            take_profit = entry - tp_distance
        
        # Calculate position size
        position_size = self._calculate_position_size(entry, stop_loss)
        
        # Validate Risk/Reward
        if not self._validate_rr(entry, stop_loss, take_profit):
            await self._log("Proposal rejected: RR ratio too low")
            return
        
        # Create proposal
        self._current_proposal = {
            "side": side,
            "entry": float(entry),
            "stop_loss": float(stop_loss),
            "take_profit": float(take_profit),
            "position_size": float(position_size),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Generate visual snapshot for chart (Ghost Lines)
        # Format: matches frontend VisualOverlay interface
        visuals = [
            {
                "shape": "line", 
                "price": float(entry), 
                "color": "#3b82f6",  # Blue for entry
                "label": f"Entry: ${float(entry):,.2f}", 
                "style": "solid"
            },
            {
                "shape": "line", 
                "price": float(stop_loss), 
                "color": "#ef4444",  # Red for stop loss
                "label": f"Stop Loss: ${float(stop_loss):,.2f}", 
                "style": "dashed"
            },
            {
                "shape": "line", 
                "price": float(take_profit), 
                "color": "#10b981",  # Green for take profit
                "label": f"Take Profit: ${float(take_profit):,.2f}", 
                "style": "dashed"
            },
        ]
        
        self.status = AgentStatus.PROPOSING
        self._last_signal_at = datetime.utcnow()
        
        await self._log(
            f"Proposing {side} trade at {entry}",
            {
                "proposal": self._current_proposal,
            },
            visuals=visuals
        )
        
        # Transition to awaiting approval
        self.status = AgentStatus.AWAITING_APPROVAL
    
    def _calculate_position_size(self, entry: Decimal, stop_loss: Decimal) -> Decimal:
        """
        Calculate position size based on risk management.
        
        Formula: Position Size = (Budget * Risk%) / |Entry - SL|
        """
        risk_amount = self.budget * self.risk_per_trade
        sl_distance = abs(entry - stop_loss)
        
        if sl_distance == 0:
            return Decimal("0")
        
        return risk_amount / sl_distance
    
    def _validate_rr(self, entry: Decimal, stop_loss: Decimal, take_profit: Decimal) -> bool:
        """
        Validate that the risk/reward ratio meets minimum requirements.
        """
        sl_distance = abs(entry - stop_loss)
        tp_distance = abs(take_profit - entry)
        
        if sl_distance == 0:
            return False
        
        rr_ratio = tp_distance / sl_distance
        return rr_ratio >= self.min_rr_ratio
    
    async def _execute_trade(self, proposal: Dict):
        """
        Execute the approved trade.
        
        Routes to Paper or Live trading based on mode.
        """
        await self._log(f"Executing {proposal['side']} trade...")
        
        # TODO: Implement actual trade execution
        # if self.mode == "PAPER":
        #     from app.services.paper_trading import PaperTradingService
        #     # Execute via paper trading
        # else:
        #     from app.services.ccxt_live_service import CCXTLiveService
        #     # Execute via live trading
        
        self.status = AgentStatus.IN_POSITION
        self._total_trades += 1
        self._current_proposal = None
        
        # Enter cooldown after trade
        self._cooldown_until = datetime.utcnow() + timedelta(minutes=5)
    
    async def _check_kill_switch(self) -> bool:
        """
        Check if the drawdown exceeds the kill switch threshold.
        """
        if self.budget == 0:
            return False
        
        drawdown_percent = (abs(self._session_pnl) / self.budget) * 100
        return self._session_pnl < 0 and drawdown_percent >= self.max_drawdown_percent
    
    async def _log(
        self,
        message: str,
        meta: Optional[Dict] = None,
        visuals: Optional[List[Dict]] = None
    ):
        """
        Create a log entry for this agent.
        
        Broadcasts to WebSocket and stores in database.
        """
        log_entry = {
            "agent_id": str(self.agent_id),
            "status": self.status.value,
            "log_text": message,
            "visual_snapshot": visuals or [],
            "meta_data": meta or {},
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        logger.info(f"Agent {self.agent_id}: {message}")
        
        if self._on_log_entry:
            await self._on_log_entry(log_entry)
    
    def get_state(self) -> Dict:
        """Get current agent state for API responses."""
        return {
            "agent_id": str(self.agent_id),
            "symbol": self.symbol,
            "mode": self.mode,
            "status": self.status.value,
            "budget": float(self.budget),
            "session_pnl": float(self._session_pnl),
            "total_trades": self._total_trades,
            "winning_trades": self._winning_trades,
            "current_proposal": self._current_proposal,
            "last_signal_at": self._last_signal_at.isoformat() if self._last_signal_at else None,
        }
