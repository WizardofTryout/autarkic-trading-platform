import asyncio
from app.services.market_service import MarketService
import time

async def test_cache():
    service = MarketService()
    
    print('\n=== Test 1: First Call (Cache Miss) ===')
    start = time.time()
    data1 = await service.get_ohlcv('SOL/USDT', '1m', 10, use_cache=True)
    time1 = time.time() - start
    print(f'Got {len(data1)} candles in {time1*1000:.1f}ms')
    if data1:
        print(f'Latest: {data1[-1]["close"]} at {data1[-1]["timestamp"]}')
    
    print('\n=== Test 2: Second Call (Cache Hit) ===')
    start = time.time()
    data2 = await service.get_ohlcv('SOL/USDT', '1m', 10, use_cache=True)
    time2 = time.time() - start
    print(f'Got {len(data2)} candles in {time2*1000:.1f}ms')
    if data2:
        print(f'Latest: {data2[-1]["close"]} at {data2[-1]["timestamp"]}')
    
    print('\n=== Test 3: Without Cache (Binance Direct) ===')
    start = time.time()
    data3 = await service.get_ohlcv('SOL/USDT', '1m', 10, use_cache=False)
    time3 = time.time() - start
    print(f'Got {len(data3)} candles in {time3*1000:.1f}ms')
    
    speedup = (time1 / time2) if time2 > 0 else 0
    print(f'\n=== Performance Summary ===')
    print(f'Cache Miss: {time1*1000:.1f}ms')
    print(f'Cache Hit:  {time2*1000:.1f}ms (🚀 {speedup:.1f}x faster)')
    print(f'No Cache:   {time3*1000:.1f}ms')
    
    await service.close()

if __name__ == '__main__':
    asyncio.run(test_cache())
