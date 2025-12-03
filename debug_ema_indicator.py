
from app.services.backtest_engine import BacktestEngine
import pandas as pd
import asyncio
from datetime import datetime

script = """
//@version=6
indicator(title="Moving Average Exponential", shorttitle="EMA", overlay=true, timeframe="", timeframe_gaps=true)
len = input.int(9, minval=1, title="Length")
src = input(close, title="Source")
offset = input.int(title="Offset", defval=0, minval=-500, maxval=500, display = display.data_window)
out = ta.ema(src, len)
plot(out, title="EMA", color=color.blue, offset=offset)

// Smoothing MA inputs
GRP = "Moving Average"
TT_BB = "Only applies when 'SMA + Bollinger Bands' is selected. Determines the distance between the SMA and the bands."
maTypeInput = input.string("None", "Type", options = ["None", "SMA", "SMA + Bollinger Bands", "EMA", "SMMA (RMA)", "WMA", "VWMA"], group = GRP, display = display.data_window)
maLengthInput = input.int(14, "Length", group = GRP, display = display.data_window)
bbMultInput = input.float(2.0, "BB StdDev", minval = 0.001, maxval = 50, step = 0.5, tooltip = TT_BB, group = GRP, display = display.data_window)
var enableMA = maTypeInput != "None"
var isBB = maTypeInput == "SMA + Bollinger Bands"

// Smoothing MA Calculation
ma(source, length, MAtype) =>
	switch MAtype
		"SMA"                   => ta.sma(source, length)
		"SMA + Bollinger Bands" => ta.sma(source, length)
		"EMA"                   => ta.ema(source, length)
		"SMMA (RMA)"            => ta.rma(source, length)
		"WMA"                   => ta.wma(source, length)
		"VWMA"                  => ta.vwma(source, length)

// Smoothing MA plots
smoothingMA = enableMA ? ma(out, maLengthInput, maTypeInput) : na
smoothingStDev = isBB ? ta.stdev(out, maLengthInput) * bbMultInput : na
plot(smoothingMA, "EMA-based MA", color=color.yellow, display = enableMA ? display.all : display.none)
bbUpperBand = plot(smoothingMA + smoothingStDev, title = "Upper Bollinger Band", color=color.green, display = isBB ? display.all : display.none)
bbLowerBand = plot(smoothingMA - smoothingStDev, title = "Lower Bollinger Band", color=color.green, display = isBB ? display.all : display.none)
fill(bbUpperBand, bbLowerBand, color= isBB ? color.new(color.green, 90) : na, title="Bollinger Bands Background Fill", display = isBB ? display.all : display.none)
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
    print("Running Debug EMA Indicator...")
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
