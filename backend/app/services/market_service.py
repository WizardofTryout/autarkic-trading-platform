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
            
            ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            
            # Convert to DataFrame for easier handling if needed, or just return list
            # For analysis, a structured string or list is often enough.
            # Let's return a list of dicts for clarity
            
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
            
            return data
        except Exception as e:
            print(f"Error fetching OHLCV for {symbol}: {e}")
            return []
        finally:
            await self.exchange.close()

    async def close(self):
        await self.exchange.close()
