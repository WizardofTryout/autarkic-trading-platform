import sys
import os
import pandas as pd
import numpy as np

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.backtest_engine import BacktestEngine

def run_debug():
    # 1. Mock Data (100 candles)
    dates = pd.date_range(start='2024-01-01', periods=100, freq='1h')
    # Create a scenario where the condition is met
    # Condition: 
    # Prev: Close < Open AND Close <= LowerBB
    # Curr: Close < Open AND Close < LowerBB
    
    # We'll generate random data first
    df = pd.DataFrame({
        'timestamp': dates,
        'open': np.random.normal(100, 5, 100),
        'high': np.random.normal(105, 5, 100),
        'low': np.random.normal(95, 5, 100),
        'close': np.random.normal(100, 5, 100),
        'volume': np.random.normal(1000, 100, 100)
    })
    df.set_index('timestamp', inplace=True)
    
    # Force the condition at index 50 and 51
    # Index 50 (Prev): Red candle, below BB
    # We need to know BB values roughly. Mean ~100. Std ~5. Lower ~ 90.
    
    # Let's just run it with random data first and see if ANY signals are generated or if it crashes.
    # The script uses input.int, so we need to make sure inputs are handled.
    
    script = """
    //@version=5
    strategy("BB Short Entry Strategy", overlay=true, margin_short=100)

    // Bollinger Bands parameters
    int bbLength = input.int(20, "BB Length", minval=1)
    float bbMult = input.float(2.0, "BB StdDev Multiplier", minval=0.1)

    // Calculate Bollinger Bands
    [middleBand, upperBand, lowerBand] = ta.bb(close, bbLength, bbMult)

    // Condition 1: Previous candle is red (closes lower than it opened) and closes at or below the lower Bollinger Band.
    bool prevCandleRedAndAtOrBelowBB = close[1] < open[1] and close[1] <= lowerBand[1]

    // Condition 2: Current candle is red (closes lower than it opened) and closes strictly below the lower Bollinger Band.
    bool currentCandleRedAndBelowBB = close[0] < open[0] and close[0] < lowerBand[0]

    // Entry condition: Both conditions are met sequentially.
    if prevCandleRedAndAtOrBelowBB and currentCandleRedAndBelowBB
        strategy.entry("Short", strategy.short)
    """
    
    print("Running Backtest Debug via Engine...")
    try:
        engine = BacktestEngine()
        # We need to mock fetch_ohlcv because we don't have real data access in debug script easily
        # But wait, the engine fetches data.
        # If I want to test the loop, I need to let it fetch data or mock it.
        
        # Let's mock fetch_ohlcv
        async def mock_fetch(*args):
            return df.reset_index().to_dict('records')
            
        engine.market_service.fetch_historical_data_range = mock_fetch
        
        import asyncio
        result = asyncio.run(engine.run_backtest(
            script=script,
            symbol="BTC/USDT",
            timeframe="1h",
            start_date=dates[0],
            end_date=dates[-1],
            initial_capital=10000,
            take_profit=2.0,
            stop_loss=1.0
        ))
        
        print("Backtest Result:", result)
            
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_debug()
