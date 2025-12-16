import ccxt.async_support as ccxt
import pandas as pd
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)


class MarketService:
    def __init__(self):
        self.exchange = ccxt.binance()
        
        # Cache freshness thresholds in seconds
        # Defines how old cached data can be before fetching from exchange
        self._cache_freshness_seconds = {
            '1s': 2,      # 1s candles: max 2 seconds old
            '1m': 10,     # 1m candles: max 10 seconds old
            '3m': 30,     # 3m candles: max 30 seconds old
            '5m': 60,     # 5m candles: max 1 minute old
            '15m': 120,   # 15m candles: max 2 minutes old
            '30m': 300,   # 30m candles: max 5 minutes old
            '1h': 300,    # 1h candles: max 5 minutes old
            '2h': 600,    # 2h candles: max 10 minutes old
            '4h': 600,    # 4h candles: max 10 minutes old
            '1d': 3600,   # 1d candles: max 1 hour old
        }

    async def get_ohlcv(
        self, 
        symbol: str, 
        timeframe: str = '1d', 
        limit: int = 100,
        use_cache: bool = True
    ) -> List[Dict]:
        """
        Fetch OHLCV data with smart caching.
        
        Strategy:
        1. If use_cache=True: Check database cache first
        2. If cache is fresh enough: Return cached data
        3. If cache miss or stale: Fetch from Binance and update cache
        4. If use_cache=False: Always fetch from Binance (bypass cache)
        
        Args:
            symbol: Trading symbol (e.g. "BTC/USDT")
            timeframe: Candle timeframe (e.g. "1m", "15m", "4h")
            limit: Number of candles to fetch
            use_cache: Whether to use database cache (default: True)
        
        Returns:
            List of OHLCV dicts with timestamp, open, high, low, close, volume
        """
        # Bypass cache if requested (e.g. for critical real-time decisions)
        if not use_cache:
            logger.debug(f"Cache bypassed for {symbol} {timeframe}")
            return await self._fetch_from_exchange(symbol, timeframe, limit)
        
        # Try cache first
        try:
            cached_data = await self._get_from_cache(symbol, timeframe, limit)
            
            if cached_data:
                # Check if cache is fresh enough
                if await self._is_cache_fresh(cached_data, timeframe):
                    logger.debug(f"Cache hit (fresh): {symbol} {timeframe} ({len(cached_data)} candles)")
                    return cached_data
                else:
                    logger.debug(f"Cache hit (stale): {symbol} {timeframe} - fetching fresh data")
            else:
                logger.debug(f"Cache miss: {symbol} {timeframe} - fetching from exchange")
        
        except Exception as e:
            logger.warning(f"Cache read failed for {symbol} {timeframe}: {e} - falling back to exchange")
        
        # Cache miss or stale - fetch from exchange
        fresh_data = await self._fetch_from_exchange(symbol, timeframe, limit)
        
        # Update cache asynchronously (don't block on this)
        if fresh_data:
            try:
                await self._update_cache(symbol, timeframe, fresh_data)
            except Exception as e:
                logger.error(f"Failed to update cache for {symbol} {timeframe}: {e}")
        
        return fresh_data
    
    async def _get_from_cache(self, symbol: str, timeframe: str, limit: int) -> Optional[List[Dict]]:
        """
        Retrieve OHLCV data from database cache.
        
        Returns:
            List of candle dicts if found, None if not in cache
        """
        from app.db.session import AsyncSessionLocal
        from sqlalchemy import select, desc
        from app.models.base import OHLCVCache
        
        try:
            async with AsyncSessionLocal() as db:
                # Query cache for most recent candles
                stmt = select(OHLCVCache).where(
                    OHLCVCache.symbol == symbol,
                    OHLCVCache.timeframe == timeframe
                ).order_by(desc(OHLCVCache.timestamp)).limit(limit)
                
                result = await db.execute(stmt)
                cached = result.scalars().all()
                
                if not cached or len(cached) < min(10, limit):
                    # Not enough data in cache
                    return None
                
                # Convert to dict format (reverse to chronological order)
                return [self._ohlcv_model_to_dict(c) for c in reversed(cached)]
        
        except Exception as e:
            logger.error(f"Cache read error: {e}")
            return None
    
    async def _is_cache_fresh(self, cached_data: List[Dict], timeframe: str) -> bool:
        """
        Check if cached data is fresh enough based on timeframe.
        
        Args:
            cached_data: List of cached candles
            timeframe: Timeframe string
        
        Returns:
            bool: True if cache is fresh, False if stale
        """
        if not cached_data:
            return False
        
        # Get newest candle timestamp
        newest_candle = cached_data[-1]
        newest_timestamp = newest_candle['timestamp']
        
        # Remove timezone info if present for comparison
        if hasattr(newest_timestamp, 'tzinfo') and newest_timestamp.tzinfo:
            newest_timestamp = newest_timestamp.replace(tzinfo=None)
        
        # Calculate age in seconds
        age_seconds = (datetime.utcnow() - newest_timestamp).total_seconds()
        
        # Get max age for this timeframe
        max_age = self._cache_freshness_seconds.get(timeframe, 60)
        
        is_fresh = age_seconds < max_age
        
        if not is_fresh:
            logger.debug(f"Cache stale: {age_seconds:.1f}s old (max: {max_age}s)")
        
        return is_fresh
    
    async def _update_cache(self, symbol: str, timeframe: str, candles: List[Dict]):
        """
        Update cache with fresh candles from exchange.
        
        Uses INSERT ... ON CONFLICT DO NOTHING to avoid duplicates.
        """
        from app.db.session import AsyncSessionLocal
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from app.models.base import OHLCVCache
        
        async with AsyncSessionLocal() as db:
            inserted = 0
            
            for candle in candles:
                try:
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
                        index_elements=['symbol', 'timeframe', 'timestamp']
                    )
                    
                    result = await db.execute(stmt)
                    if result.rowcount > 0:
                        inserted += 1
                
                except Exception as e:
                    logger.error(f"Error caching candle: {e}")
            
            await db.commit()
            
            if inserted > 0:
                logger.debug(f"Cached {inserted} new candles for {symbol} {timeframe}")
    
    def _ohlcv_model_to_dict(self, model) -> Dict:
        """Convert SQLAlchemy OHLCVCache model to dict."""
        return {
            'timestamp': model.timestamp,
            'open': float(model.open),
            'high': float(model.high),
            'low': float(model.low),
            'close': float(model.close),
            'volume': float(model.volume),
        }
    
    async def _fetch_from_exchange(self, symbol: str, timeframe: str, limit: int) -> List[Dict]:
        """
        Fetch OHLCV directly from Binance (original implementation).
        
        This is the fallback when cache is unavailable or stale.
        """
        try:
            # Map common timeframe strings if necessary
            # ccxt uses '1m', '5m', '1h', '1d' etc.
            # Ensure timeframe is valid for Binance
            valid_timeframes = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
            
            target_timeframe = timeframe
            is_resampled = False
            
            # Special handling for 15s if not natively supported (Binance usually supports 1s)
            if timeframe == '15s':
                timeframe = '1s'
                limit = limit * 15  # Fetch more 1s candles to resample
                is_resampled = True
            
            if timeframe not in valid_timeframes:
                print(f"Warning: Invalid timeframe {timeframe}, defaulting to 1d")
                timeframe = '1d'

            ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            
            data = []
            for candle in ohlcv:
                timestamp, open_p, high, low, close, volume = candle
                data.append({
                    'timestamp': datetime.fromtimestamp(timestamp / 1000),
                    'open': open_p,
                    'high': high,
                    'low': low,
                    'close': close,
                    'volume': volume
                })
            
            # Resample if needed (e.g. 15s from 1s)
            if is_resampled and target_timeframe == '15s' and data:
                df = pd.DataFrame(data)
                df.set_index('timestamp', inplace=True)
                
                # Resample to 15s
                resampled = df.resample('15s').agg({
                    'open': 'first',
                    'high': 'max',
                    'low': 'min',
                    'close': 'last',
                    'volume': 'sum'
                }).dropna()
                
                # Convert back to list of dicts
                data = []
                for timestamp, row in resampled.iterrows():
                    data.append({
                        'timestamp': timestamp,
                        'open': row['open'],
                        'high': row['high'],
                        'low': row['low'],
                        'close': row['close'],
                        'volume': row['volume']
                    })
                
                # Limit to original requested limit
                data = data[-int(limit/15):]
            
            return data
        except Exception as e:
            print(f"Error fetching OHLCV for {symbol}: {e}")
            return []

    async def fetch_historical_data_range(self, symbol: str, timeframe: str, start_date: datetime, end_date: datetime):
        """
        Fetch historical OHLCV data for a specific date range using pagination.
        """
        all_candles = []
        since = int(start_date.timestamp() * 1000)
        end_ts = int(end_date.timestamp() * 1000)
        limit = 1000  # Binance max limit

        try:
            while since < end_ts:
                ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
                if not ohlcv:
                    break
                
                all_candles.extend(ohlcv)
                
                # Update 'since' to the timestamp of the last candle + 1 timeframe duration
                last_timestamp = ohlcv[-1][0]
                since = last_timestamp + 1 # Just move forward slightly, fetch_ohlcv handles overlaps usually, but better to be safe or rely on since
                
                # If we got fewer candles than limit, we reached the end
                if len(ohlcv) < limit:
                    break
                    
                # Safety break if last timestamp >= end_ts
                if last_timestamp >= end_ts:
                    break

            # Filter and Format
            data = []
            for candle in all_candles:
                timestamp, open_p, high, low, close, volume = candle
                if timestamp > end_ts:
                    continue
                if timestamp < int(start_date.timestamp() * 1000):
                    continue
                    
                data.append({
                    'timestamp': datetime.fromtimestamp(timestamp / 1000),
                    'open': open_p,
                    'high': high,
                    'low': low,
                    'close': close,
                    'volume': volume
                })
            
            # Remove duplicates based on timestamp just in case
            # (using dict comprehension)
            unique_data = {d['timestamp']: d for d in data}.values()
            return sorted(list(unique_data), key=lambda x: x['timestamp'])

        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {e}")
            return []

    async def get_current_price(self, symbol: str) -> float:
        """
        Fetch current price (ticker) from Binance.
        """
        try:
            ticker = await self.exchange.fetch_ticker(symbol)
            return ticker['last']
        except Exception as e:
            print(f"Error fetching ticker for {symbol}: {e}")
            return None

    async def close(self):
        await self.exchange.close()
