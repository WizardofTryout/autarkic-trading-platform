"""
Bitget OHLCV Data Collection Tasks

Celery tasks for collecting and caching OHLCV data from Bitget.
Runs in PARALLEL with the existing Binance collector to enable
arbitrage analysis and cross-exchange comparisons.

IMPORTANT: This is a PARALLEL stream, not a replacement.
- Binance data -> exchange='binance'
- Bitget data -> exchange='bitget'
"""

import asyncio
import logging
from datetime import datetime
from typing import Set, Tuple, List, Dict

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.models.base import TradingAgent, OHLCVCache
from app.services.exchanges import BitgetService

logger = logging.getLogger(__name__)

# In-memory API client (we don't need auth for public market data)
_bitget_client = None


def _get_public_client():
    """Get a BitgetService instance for public data (no auth needed)."""
    global _bitget_client
    if _bitget_client is None:
        # Empty credentials for public endpoints only
        _bitget_client = BitgetService(
            api_key="", 
            secret="", 
            passphrase=""
        )
    return _bitget_client


@celery_app.task(name="app.tasks.collect_ohlcv_bitget.collect_bitget_active_symbols")
def collect_bitget_active_symbols():
    """
    Collect OHLCV data from Bitget for all symbols used by active LIVE trading agents.
    
    IMPORTANT DIFFERENCE FROM BINANCE COLLECTOR:
    - Only collects for agents in LIVE mode (not PAPER)
    - Stores with exchange='bitget'
    
    This enables:
    1. Price accuracy for live trading (trade on Bitget, use Bitget prices)
    2. Cross-exchange arbitrage analysis (compare Binance vs Bitget)
    
    Runs every 60 seconds via Celery Beat.
    """
    logger.info("Starting Bitget OHLCV collection for LIVE agent symbols")
    
    try:
        result = asyncio.run(_collect_bitget_active_symbols())
        logger.info(f"Bitget OHLCV collection completed: {result}")
        return result
    except Exception as e:
        logger.error(f"Bitget OHLCV collection failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e), "exchange": "bitget"}


async def _collect_bitget_active_symbols() -> Dict:
    """Internal async implementation of Bitget collection logic."""
    async with AsyncSessionLocal() as db:
        # Step 1: Get symbol/timeframe pairs from LIVE agents only
        symbol_tf_pairs = await _get_live_agent_symbol_timeframes(db)
        
        if not symbol_tf_pairs:
            logger.info("No LIVE agents found - skipping Bitget collection")
            return {
                "status": "skipped",
                "reason": "no_live_agents",
                "exchange": "bitget",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        logger.info(f"Found {len(symbol_tf_pairs)} unique pairs for Bitget collection")
        
        # Step 2: Collect data for each pair
        bitget_client = _get_public_client()
        collected_candles = 0
        failed_pairs = []
        
        try:
            for symbol, timeframe in symbol_tf_pairs:
                try:
                    # Fetch latest 2 candles from Bitget
                    candles = await bitget_client.fetch_ohlcv(
                        symbol=symbol,
                        timeframe=timeframe,
                        limit=2
                    )
                    
                    if candles:
                        # Convert to dict format and store
                        candle_dicts = _convert_ohlcv_to_dicts(candles)
                        stored = await _store_bitget_candles(db, symbol, timeframe, candle_dicts)
                        collected_candles += stored
                        logger.debug(f"Stored {stored} Bitget candles for {symbol} {timeframe}")
                    else:
                        logger.warning(f"No Bitget candles returned for {symbol} {timeframe}")
                        failed_pairs.append((symbol, timeframe))
                        
                except Exception as e:
                    logger.error(f"Failed to collect Bitget {symbol} {timeframe}: {e}")
                    failed_pairs.append((symbol, timeframe))
            
            # Commit all insertions
            await db.commit()
            
            return {
                "status": "success",
                "exchange": "bitget",
                "collected_candles": collected_candles,
                "symbol_timeframe_pairs": len(symbol_tf_pairs),
                "failed_pairs": len(failed_pairs),
                "timestamp": datetime.utcnow().isoformat()
            }
            
        finally:
            await bitget_client.close()


async def _get_live_agent_symbol_timeframes(db) -> Set[Tuple[str, str]]:
    """
    Extract unique (symbol, timeframe) pairs from LIVE mode agents only.
    
    Returns:
        Set of tuples: {("BTC/USDT", "1m"), ("BTC/USDT", "4h"), ...}
    """
    # Query only LIVE mode active agents
    result = await db.execute(
        select(
            TradingAgent.symbol,
            TradingAgent.macro_timeframe,
            TradingAgent.micro_timeframe
        ).where(
            TradingAgent.mode == 'LIVE',
            TradingAgent.status.in_([
                'SCANNING',
                'ACTIVE',
                'IN_POSITION',
                'AWAITING_APPROVAL'
            ])
        )
    )
    
    agents = result.fetchall()
    
    # Extract unique pairs
    symbol_tf_pairs = set()
    for agent in agents:
        symbol = agent.symbol
        macro_tf = agent.macro_timeframe
        micro_tf = agent.micro_timeframe
        
        if symbol and macro_tf:
            symbol_tf_pairs.add((symbol, macro_tf))
        if symbol and micro_tf:
            symbol_tf_pairs.add((symbol, micro_tf))
    
    return symbol_tf_pairs


def _convert_ohlcv_to_dicts(candles: List[List]) -> List[Dict]:
    """Convert raw OHLCV list format to dict format."""
    result = []
    for candle in candles:
        result.append({
            'timestamp': datetime.fromtimestamp(candle[0] / 1000),  # ms to datetime
            'open': candle[1],
            'high': candle[2],
            'low': candle[3],
            'close': candle[4],
            'volume': candle[5]
        })
    return result


async def _store_bitget_candles(db, symbol: str, timeframe: str, candles: List[Dict]) -> int:
    """
    Store Bitget candles in database with exchange='bitget'.
    Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicates.
    """
    inserted = 0
    
    for candle in candles:
        try:
            # PostgreSQL-specific INSERT with ON CONFLICT
            stmt = pg_insert(OHLCVCache).values(
                exchange='bitget',  # KEY DIFFERENCE: mark as Bitget data
                symbol=symbol,
                timeframe=timeframe,
                timestamp=candle['timestamp'],
                open=candle['open'],
                high=candle['high'],
                low=candle['low'],
                close=candle['close'],
                volume=candle['volume']
            ).on_conflict_do_nothing(
                # Use the NEW unique constraint that includes exchange
                index_elements=['exchange', 'symbol', 'timeframe', 'timestamp']
            )
            
            result = await db.execute(stmt)
            
            if result.rowcount > 0:
                inserted += 1
                
        except Exception as e:
            logger.error(f"Error storing Bitget candle for {symbol} {timeframe}: {e}")
    
    return inserted
