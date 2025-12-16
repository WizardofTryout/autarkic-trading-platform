"""
OHLCV Data Retention Policy

Celery task for cleaning up old OHLCV data based on timeframe-specific retention rules.
Prevents database bloat while keeping relevant historical data for analysis and backtesting.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict

from sqlalchemy import delete, select, func

from app.core.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.models.base import OHLCVCache

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.cleanup_ohlcv.cleanup_old_candles")
def cleanup_old_candles():
    """
    Delete old OHLCV data based on timeframe-specific retention policy.
    
    Retention Rules:
    - 1s candles:  Keep for 1 day (scalping/tick data)
    - 1m candles:  Keep for 7 days (short-term analysis)
    - 5m candles:  Keep for 14 days
    - 15m candles: Keep for 30 days (intraday strategies)
    - 30m candles: Keep for 30 days
    - 1h candles:  Keep for 60 days (swing trading)
    - 2h candles:  Keep for 60 days
    - 4h candles:  Keep for 90 days (position trading)
    - 6h candles:  Keep for 90 days
    - 12h candles: Keep for 180 days
    - 1d candles:  Keep for 365 days (long-term backtesting)
    - 1w candles:  Keep for 730 days (2 years)
    
    Runs daily at 3 AM UTC via Celery Beat.
    
    Returns:
        dict: Summary of cleanup operation
    """
    logger.info("Starting OHLCV data cleanup")
    
    try:
        result = asyncio.run(_cleanup_old_candles())
        logger.info(f"OHLCV cleanup completed: {result}")
        return result
    except Exception as e:
        logger.error(f"OHLCV cleanup failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


async def _cleanup_old_candles() -> Dict:
    """Internal async implementation of cleanup logic."""
    
    # Retention policy in days
    retention_days = {
        '1s': 1,      # Tick data for ultra-short-term analysis
        '1m': 7,      # Week of minute data
        '3m': 14,     # Two weeks
        '5m': 14,     # Two weeks
        '15m': 30,    # Month of intraday data
        '30m': 30,    # Month
        '1h': 60,     # 2 months for swing trading
        '2h': 60,     # 2 months
        '4h': 90,     # Quarter for position trading
        '6h': 90,     # Quarter
        '8h': 90,     # Quarter
        '12h': 180,   # Half year
        '1d': 365,    # Year of daily candles (essential for backtesting)
        '3d': 730,    # 2 years
        '1w': 730,    # 2 years of weekly data
        '1M': 1095,   # 3 years of monthly data
    }
    
    async with AsyncSessionLocal() as db:
        total_deleted = 0
        deletion_details = {}
        
        for timeframe, days in retention_days.items():
            # Calculate cutoff date
            cutoff = datetime.utcnow() - timedelta(days=days)
            
            logger.info(f"Cleaning {timeframe} candles older than {cutoff.isoformat()} ({days} days)")
            
            # Delete old candles for this timeframe
            result = await db.execute(
                delete(OHLCVCache).where(
                    OHLCVCache.timeframe == timeframe,
                    OHLCVCache.timestamp < cutoff
                )
            )
            
            deleted = result.rowcount
            total_deleted += deleted
            
            if deleted > 0:
                deletion_details[timeframe] = {
                    "deleted": deleted,
                    "cutoff_date": cutoff.isoformat(),
                    "retention_days": days
                }
                logger.info(f"  ✅ Deleted {deleted} {timeframe} candles")
            else:
                logger.debug(f"  ⏭️  No {timeframe} candles to delete")
        
        # Commit deletions
        await db.commit()
        
        # Get final statistics
        stats = await _get_cache_statistics(db)
        
        logger.info(f"Total candles deleted: {total_deleted}")
        logger.info(f"Remaining candles in cache: {stats['total_candles']}")
        
        return {
            "status": "success",
            "total_deleted": total_deleted,
            "deletion_details": deletion_details,
            "cache_statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }


async def _get_cache_statistics(db) -> Dict:
    """
    Get statistics about the OHLCV cache.
    
    Returns:
        dict: Cache statistics including counts by timeframe, size estimates, etc.
    """
    try:
        # Total candles
        result = await db.execute(
            select(func.count()).select_from(OHLCVCache)
        )
        total_candles = result.scalar()
        
        # Count by timeframe
        result = await db.execute(
            select(
                OHLCVCache.timeframe,
                func.count(OHLCVCache.id).label('count')
            ).group_by(OHLCVCache.timeframe)
        )
        by_timeframe = {row.timeframe: row.count for row in result}
        
        # Oldest and newest timestamps
        result = await db.execute(
            select(
                func.min(OHLCVCache.timestamp).label('oldest'),
                func.max(OHLCVCache.timestamp).label('newest')
            )
        )
        row = result.first()
        oldest = row.oldest.isoformat() if row.oldest else None
        newest = row.newest.isoformat() if row.newest else None
        
        # Estimate DB size (rough calculation: ~120 bytes per row)
        estimated_size_mb = (total_candles * 120) / (1024 * 1024)
        
        return {
            "total_candles": total_candles,
            "by_timeframe": by_timeframe,
            "oldest_timestamp": oldest,
            "newest_timestamp": newest,
            "estimated_size_mb": round(estimated_size_mb, 2)
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache statistics: {e}")
        return {
            "total_candles": 0,
            "error": str(e)
        }


@celery_app.task(name="app.tasks.cleanup_ohlcv.get_cache_stats")
def get_cache_stats():
    """
    Get current OHLCV cache statistics.
    
    Useful for monitoring and debugging. Can be called manually or from admin dashboard.
    
    Returns:
        dict: Cache statistics
    """
    logger.info("Fetching OHLCV cache statistics")
    
    try:
        result = asyncio.run(_get_cache_stats())
        logger.info(f"Cache stats: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


async def _get_cache_stats() -> Dict:
    """Internal async implementation of stats fetching."""
    async with AsyncSessionLocal() as db:
        stats = await _get_cache_statistics(db)
        return {
            "status": "success",
            **stats,
            "timestamp": datetime.utcnow().isoformat()
        }
