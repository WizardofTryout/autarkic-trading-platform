"""
OHLCV Data Collection Tasks

Celery tasks for collecting and caching OHLCV data from Binance.
Reduces API calls by pre-fetching data for active trading symbols.
"""

import asyncio
import logging
from datetime import datetime
from typing import Set, Tuple, List, Dict

from sqlalchemy import select, insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.models.base import TradingAgent, OHLCVCache
from app.services.market_service import MarketService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.collect_ohlcv.collect_active_symbols")
def collect_active_symbols():
    """
    Collect OHLCV data for all symbols used by active trading agents.
    
    This task:
    1. Identifies all active agents and their symbols/timeframes
    2. Fetches latest candles from Binance
    3. Stores them in ohlcv_cache table
    4. Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicates
    
    Runs every 60 seconds via Celery Beat.
    
    Returns:
        dict: Summary of collection operation
    """
    logger.info("Starting OHLCV collection for active symbols")
    
    try:
        result = asyncio.run(_collect_active_symbols())
        logger.info(f"OHLCV collection completed: {result}")
        return result
    except Exception as e:
        logger.error(f"OHLCV collection failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


async def _collect_active_symbols() -> Dict:
    """Internal async implementation of collection logic."""
    async with AsyncSessionLocal() as db:
        # Step 1: Get all active agents and their symbol/timeframe pairs
        symbol_tf_pairs = await _get_active_symbol_timeframes(db)
        
        if not symbol_tf_pairs:
            logger.info("No active agents found - skipping collection")
            return {
                "status": "skipped",
                "reason": "no_active_agents",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        logger.info(f"Found {len(symbol_tf_pairs)} unique symbol/timeframe pairs to collect")
        
        # Step 2: Collect data for each pair
        market_service = MarketService()
        collected_candles = 0
        failed_pairs = []
        
        try:
            for symbol, timeframe in symbol_tf_pairs:
                try:
                    # Fetch latest 2 candles (current + previous to ensure we have closed candle)
                    candles = await market_service.get_ohlcv(
                        symbol=symbol,
                        timeframe=timeframe,
                        limit=2
                    )
                    
                    if candles:
                        # Store in database
                        stored = await _store_candles(db, symbol, timeframe, candles)
                        collected_candles += stored
                        logger.debug(f"Stored {stored} candles for {symbol} {timeframe}")
                    else:
                        logger.warning(f"No candles returned for {symbol} {timeframe}")
                        failed_pairs.append((symbol, timeframe))
                        
                except Exception as e:
                    logger.error(f"Failed to collect {symbol} {timeframe}: {e}")
                    failed_pairs.append((symbol, timeframe))
            
            # Commit all insertions
            await db.commit()
            
            return {
                "status": "success",
                "collected_candles": collected_candles,
                "symbol_timeframe_pairs": len(symbol_tf_pairs),
                "failed_pairs": len(failed_pairs),
                "timestamp": datetime.utcnow().isoformat()
            }
            
        finally:
            await market_service.close()


async def _get_active_symbol_timeframes(db) -> Set[Tuple[str, str]]:
    """
    Extract unique (symbol, timeframe) pairs from active agents.
    
    Returns:
        Set of tuples: {("BTC/USDT", "1m"), ("BTC/USDT", "4h"), ...}
    """
    # Query active agents
    result = await db.execute(
        select(
            TradingAgent.symbol,
            TradingAgent.macro_timeframe,
            TradingAgent.micro_timeframe
        ).where(
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


async def _store_candles(db, symbol: str, timeframe: str, candles: List[Dict]) -> int:
    """
    Store candles in database using INSERT ... ON CONFLICT DO NOTHING.
    
    Args:
        db: Database session
        symbol: Trading symbol (e.g. "BTC/USDT")
        timeframe: Timeframe (e.g. "1m")
        candles: List of candle dicts with OHLCV data
    
    Returns:
        int: Number of candles successfully inserted (not duplicates)
    """
    inserted = 0
    
    for candle in candles:
        try:
            # PostgreSQL-specific INSERT with ON CONFLICT
            stmt = pg_insert(OHLCVCache).values(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=candle['timestamp'],
                open=candle['open'],
                high=candle['high'],
                low=candle['low'],
                close=candle['close'],
                volume=candle['volume']
            ).on_conflict_do_nothing(
                # Use the unique constraint we defined
                index_elements=['symbol', 'timeframe', 'timestamp']
            )
            
            result = await db.execute(stmt)
            
            # Check if row was actually inserted (not a duplicate)
            if result.rowcount > 0:
                inserted += 1
                
        except Exception as e:
            logger.error(f"Error storing candle for {symbol} {timeframe} at {candle.get('timestamp')}: {e}")
    
    return inserted


@celery_app.task(name="app.tasks.collect_ohlcv.collect_historical_data")
def collect_historical_data(symbol: str, timeframe: str, days: int = 30):
    """
    Backfill historical data for a specific symbol/timeframe pair.
    
    This is useful for:
    1. Initial data population when adding a new symbol
    2. Backfilling gaps after system downtime
    3. Preparing data for backtesting
    
    Args:
        symbol: Trading symbol (e.g. "BTC/USDT")
        timeframe: Timeframe (e.g. "15m")
        days: Number of days of historical data to fetch
    
    Returns:
        dict: Summary of backfill operation
    """
    logger.info(f"Starting historical data collection for {symbol} {timeframe} ({days} days)")
    
    try:
        result = asyncio.run(_collect_historical_data(symbol, timeframe, days))
        logger.info(f"Historical collection completed: {result}")
        return result
    except Exception as e:
        logger.error(f"Historical collection failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


async def _collect_historical_data(symbol: str, timeframe: str, days: int) -> Dict:
    """Internal async implementation of historical collection."""
    from datetime import timedelta
    
    async with AsyncSessionLocal() as db:
        market_service = MarketService()
        
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            logger.info(f"Fetching {symbol} {timeframe} from {start_date} to {end_date}")
            
            # Fetch historical range
            candles = await market_service.fetch_historical_data_range(
                symbol=symbol,
                timeframe=timeframe,
                start_date=start_date,
                end_date=end_date
            )
            
            if not candles:
                return {
                    "status": "no_data",
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "days": days
                }
            
            # Store in database
            stored = await _store_candles(db, symbol, timeframe, candles)
            await db.commit()
            
            return {
                "status": "success",
                "symbol": symbol,
                "timeframe": timeframe,
                "days": days,
                "fetched_candles": len(candles),
                "stored_candles": stored,
                "duplicates_skipped": len(candles) - stored,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        finally:
            await market_service.close()
