from fastapi import APIRouter, Query
import ccxt.async_support as ccxt
from datetime import datetime

router = APIRouter()

@router.get("/ticker/{symbol}")
async def get_ticker(symbol: str):
    exchange = ccxt.binance()
    try:
        ticker = await exchange.fetch_ticker(symbol)
        return {"symbol": symbol, "price": ticker['last']}
    except Exception as e:
        print(f"Error fetching ticker: {e}")
        return {"symbol": symbol, "price": 0.0}
    finally:
        await exchange.close()

@router.get("/ohlcv")
async def get_ohlcv(
    symbol: str = Query(..., description="Trading symbol, e.g. BTC/USDT"), 
    timeframe: str = Query("1h", description="Timeframe, e.g. 1m, 1h, 1d"), 
    limit: int = Query(100, description="Number of candles")
):
    """
    Get OHLCV data for a symbol from Binance via CCXT.
    """
    
    # Map timeframe string to CCXT format
    tf_map = {
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "4h": "4h",
        "1d": "1d"
    }
    ccxt_timeframe = tf_map.get(timeframe, "1h")
    
    # Initialize exchange
    exchange = ccxt.binance()
    
    try:
        # Fetch OHLCV
        ohlcv = await exchange.fetch_ohlcv(symbol, ccxt_timeframe, limit=limit)
        
        # Parse data
        data = []
        for candle in ohlcv:
            # candle structure: [timestamp, open, high, low, close, volume]
            timestamp = candle[0]
            dt_object = datetime.fromtimestamp(timestamp / 1000)
            time_str = dt_object.strftime("%Y-%m-%d %H:%M:%S")
            
            data.append({
                "time": time_str,
                "open": candle[1],
                "high": candle[2],
                "low": candle[3],
                "close": candle[4],
                "volume": candle[5]
            })
            
        return data
        
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []
    finally:
        await exchange.close()
