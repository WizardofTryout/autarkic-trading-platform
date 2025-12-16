#!/usr/bin/env python3
"""
Load Test Script for OHLCV Cache System
Simulates multiple concurrent agent requests and measures cache performance
"""

import asyncio
import time
from datetime import datetime
from app.services.market_service import MarketService
from app.db.session import AsyncSessionLocal

# Test configuration
SYMBOLS = ["SOL/USDT", "BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT"]
TIMEFRAMES = ["1m", "5m"]
REQUESTS_PER_SYMBOL = 10
CONCURRENT_REQUESTS = 5

async def fetch_ohlcv(symbol: str, timeframe: str, request_id: int, use_cache: bool = True):
    """Simulate a single agent request"""
    start = time.time()
    
    try:
        async with AsyncSessionLocal() as db:
            market_service = MarketService(db)
            candles = await market_service.get_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                limit=50,
                use_cache=use_cache
            )
            
        elapsed = (time.time() - start) * 1000  # Convert to ms
        cache_status = "CACHE" if use_cache else "DIRECT"
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "request_id": request_id,
            "elapsed_ms": elapsed,
            "candle_count": len(candles),
            "cache_status": cache_status,
            "success": True
        }
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "request_id": request_id,
            "elapsed_ms": elapsed,
            "cache_status": "ERROR",
            "error": str(e),
            "success": False
        }

async def run_load_test():
    """Execute load test with concurrent requests"""
    
    print("=" * 70)
    print("🚀 OHLCV CACHE LOAD TEST")
    print("=" * 70)
    print(f"Symbols: {len(SYMBOLS)}")
    print(f"Timeframes: {len(TIMEFRAMES)}")
    print(f"Requests per symbol: {REQUESTS_PER_SYMBOL}")
    print(f"Concurrent requests: {CONCURRENT_REQUESTS}")
    print(f"Total requests: {len(SYMBOLS) * len(TIMEFRAMES) * REQUESTS_PER_SYMBOL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("=" * 70)
    print()
    
    # Phase 1: Concurrent requests WITH cache
    print("📊 Phase 1: Testing with cache enabled...")
    tasks = []
    for symbol in SYMBOLS:
        for timeframe in TIMEFRAMES:
            for i in range(REQUESTS_PER_SYMBOL):
                tasks.append(fetch_ohlcv(symbol, timeframe, i, use_cache=True))
    
    start_time = time.time()
    results_with_cache = await asyncio.gather(*tasks)
    phase1_duration = time.time() - start_time
    
    # Phase 2: Wait a bit, then test WITHOUT cache
    print("\n⏳ Waiting 2 seconds before Phase 2...\n")
    await asyncio.sleep(2)
    
    print("📊 Phase 2: Testing WITHOUT cache (direct Binance)...")
    tasks = []
    for symbol in SYMBOLS[:2]:  # Only test 2 symbols to avoid rate limits
        for timeframe in TIMEFRAMES:
            for i in range(3):  # Only 3 requests per pair
                tasks.append(fetch_ohlcv(symbol, timeframe, i, use_cache=False))
    
    start_time = time.time()
    results_without_cache = await asyncio.gather(*tasks)
    phase2_duration = time.time() - start_time
    
    # Analyze results
    print("\n" + "=" * 70)
    print("📈 RESULTS")
    print("=" * 70)
    
    # Phase 1 stats
    phase1_success = [r for r in results_with_cache if r["success"]]
    phase1_failed = [r for r in results_with_cache if not r["success"]]
    
    if phase1_success:
        phase1_times = [r["elapsed_ms"] for r in phase1_success]
        phase1_avg = sum(phase1_times) / len(phase1_times)
        phase1_min = min(phase1_times)
        phase1_max = max(phase1_times)
        
        print(f"\n🟢 Phase 1: WITH CACHE ({len(phase1_success)} successful)")
        print(f"   Total Duration: {phase1_duration:.2f}s")
        print(f"   Average Response: {phase1_avg:.1f}ms")
        print(f"   Min Response: {phase1_min:.1f}ms")
        print(f"   Max Response: {phase1_max:.1f}ms")
        print(f"   Failed Requests: {len(phase1_failed)}")
        print(f"   Requests/sec: {len(phase1_success)/phase1_duration:.2f}")
    
    # Phase 2 stats
    phase2_success = [r for r in results_without_cache if r["success"]]
    phase2_failed = [r for r in results_without_cache if not r["success"]]
    
    if phase2_success:
        phase2_times = [r["elapsed_ms"] for r in phase2_success]
        phase2_avg = sum(phase2_times) / len(phase2_times)
        phase2_min = min(phase2_times)
        phase2_max = max(phase2_times)
        
        print(f"\n🔴 Phase 2: WITHOUT CACHE ({len(phase2_success)} successful)")
        print(f"   Total Duration: {phase2_duration:.2f}s")
        print(f"   Average Response: {phase2_avg:.1f}ms")
        print(f"   Min Response: {phase2_min:.1f}ms")
        print(f"   Max Response: {phase2_max:.1f}ms")
        print(f"   Failed Requests: {len(phase2_failed)}")
        print(f"   Requests/sec: {len(phase2_success)/phase2_duration:.2f}")
    
    # Comparison
    if phase1_success and phase2_success:
        speedup = phase2_avg / phase1_avg
        print(f"\n⚡ CACHE PERFORMANCE")
        print(f"   Speedup Factor: {speedup:.2f}x faster")
        print(f"   Time Saved: {phase2_avg - phase1_avg:.1f}ms per request")
        print(f"   Throughput Increase: {(len(phase1_success)/phase1_duration) / (len(phase2_success)/phase2_duration):.2f}x")
    
    # Per-symbol breakdown
    print(f"\n📊 PER-SYMBOL BREAKDOWN (WITH CACHE)")
    print("-" * 70)
    for symbol in SYMBOLS:
        symbol_results = [r for r in phase1_success if r["symbol"] == symbol]
        if symbol_results:
            avg_time = sum(r["elapsed_ms"] for r in symbol_results) / len(symbol_results)
            print(f"   {symbol:12} - {len(symbol_results):3} requests - Avg: {avg_time:6.1f}ms")
    
    print("\n" + "=" * 70)
    print("✅ Load test completed!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_load_test())
