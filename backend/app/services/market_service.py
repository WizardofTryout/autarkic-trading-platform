import ccxt.async_support as ccxt
import pandas as pd
from datetime import datetime, timedelta

class MarketService:
    def __init__(self):
        self.exchange = ccxt.binance()

    async def get_ohlcv(self, symbol: str, timeframe: str = '1d', limit: int = 100):
        """
        Fetch OHLCV data from Binance.
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
