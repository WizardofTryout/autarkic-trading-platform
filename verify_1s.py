import asyncio
import ccxt.async_support as ccxt

async def main():
    exchange = ccxt.binance()
    try:
        print("Fetching 1s candles for BTC/USDT...")
        ohlcv = await exchange.fetch_ohlcv('BTC/USDT', '1s', limit=5)
        print(f"Success! Retrieved {len(ohlcv)} candles.")
        for candle in ohlcv:
            print(candle)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await exchange.close()

if __name__ == "__main__":
    asyncio.run(main())
