
from app.services.backtest_engine import BacktestEngine
import pandas as pd
import asyncio
from datetime import datetime

script = """
//@version=5
strategy(title="Two Consecutive Upper BB Touch Long Strategy",
         shorttitle="2xUBB Long",
         overlay=true,
         pyramiding=0, // No pyramiding for this strategy
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=100, // Use 100% of equity for each trade by default
         commission_type=strategy.commission.percent,
         commission_value=0.1, // 0.1% commission
         initial_capital=10000)

// --- Bollinger Bands Inputs ---
bbLength = input.int(20, title="BB Length", minval=1)
bbMult = input.float(2.0, title="BB Multiplier", minval=0.1, step=0.1)

// --- Calculate Bollinger Bands ---
sma = ta.sma(close, bbLength)
stdDev = ta.stdev(close, bbLength)
upperBB = sma + stdDev * bbMult
lowerBB = sma - stdDev * bbMult

// --- Plot Bollinger Bands on the chart ---
plot(upperBB, "Upper BB", color=color.new(color.blue, 0))
plot(lowerBB, "Lower BB", color=color.new(color.blue, 0))
plot(sma, "SMA", color=color.new(color.orange, 0))

// --- Define the condition for a candle touching the Upper Bollinger Band ---
// A candle touches the upper Bollinger Band if its high price is greater than or equal to the upper BB line.
touchUpperBB = high >= upperBB

// --- Entry Condition ---
// The strategy enters a long trade if:
// 1. The current candle (`touchUpperBB`) touches the upper Bollinger Band.
// 2. The previous candle (`touchUpperBB[1]`) also touched the upper Bollinger Band.
longCondition = touchUpperBB and touchUpperBB[1]

// --- Execute Long Trade ---
if longCondition
    strategy.entry("Long", strategy.long, comment="2x UBB Touch")

// --- Optional: Plotting entry signals for visual confirmation ---
plotshape(longCondition, title="Long Entry Signal", location=location.belowbar, color=color.new(color.green, 0), style=shape.triangleup, size=size.small)
"""

# Mock Data
dates = pd.date_range(start="2024-01-01", periods=100, freq="1h")
data = {
    "timestamp": dates,
    "open": [40000 + i*10 for i in range(100)],
    "high": [40100 + i*10 for i in range(100)],
    "low": [39900 + i*10 for i in range(100)],
    "close": [40050 + i*10 for i in range(100)],
    "volume": [1000 for _ in range(100)]
}
df = pd.DataFrame(data)

async def run():
    print("Running Debug UBB Strategy...")
    engine = BacktestEngine()
    
    # Mock fetch
    async def mock_fetch(*args):
        return df.reset_index().to_dict('records')
    engine.market_service.fetch_historical_data_range = mock_fetch
    
    try:
        result = await engine.run_backtest(
            script=script,
            symbol="BTC/USDT",
            timeframe="1h",
            start_date=dates[0],
            end_date=dates[-1],
            initial_capital=10000
        )
        print("Result:", result)
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
