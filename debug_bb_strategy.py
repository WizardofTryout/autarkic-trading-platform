
from app.services.backtest_engine import BacktestEngine
import pandas as pd
import asyncio
from datetime import datetime

script = """
//@version=5
strategy("Zwei Grüne Kerzen über BB Mittelstrategie", overlay=true, 
         initial_capital=10000, currency=currency.USD, 
         default_qty_type=strategy.percent_of_equity, default_qty_value=100, 
         pyramiding=0) // Pyramiding=0 ensures only one position at a time

// Input-Einstellungen für Bollinger Bänder
bbLength = input.int(20, "BB Länge", minval=1)
bbMult = input.float(2.0, "BB Standardabweichung Multiplikator", minval=0.1)

// Input-Einstellungen für Risikomanagement
stopLossPercent = input.float(1.5, "Stop Loss (%)", minval=0.1, maxval=100) / 100 // In Dezimal umrechnen (z.B. 1.5% -> 0.015)
riskRewardRatio = input.float(3.0, "Risiko/Ertrags-Verhältnis", minval=1.0) // Für 1:3

// Bollinger Bänder berechnen
[bbMiddle, bbUpper, bbLower] = ta.bb(close, bbLength, bbMult)

// Entry-Bedingungen definieren
// Bedingung 1: Vorherige Kerze war grün und schloss über der BB Mittellinie
cond1_green_candle = close[1] > open[1]
cond1_above_bb_middle = close[1] > bbMiddle[1]

// Bedingung 2: Aktuelle Kerze ist grün und schliesst über der BB Mittellinie
cond2_green_candle = close > open
cond2_above_bb_middle = close > bbMiddle

// Gesamte Entry-Bedingung
enterLong = cond1_green_candle and cond1_above_bb_middle and cond2_green_candle and cond2_above_bb_middle

// Strategie-Logik
if enterLong and strategy.opentrades == 0 // Stelle sicher, dass keine offene Position existiert
    strategy.entry("Long", strategy.long)

// Bestimme Stop Loss und Take Profit Niveaus, wenn eine Position geöffnet ist
if strategy.position_size > 0
    entryPrice = strategy.position_avg_price
    
    // Stop Loss Preis berechnen
    stopLossPrice = entryPrice * (1 - stopLossPercent)
    
    // Take Profit Preis basierend auf dem Risiko/Ertrags-Verhältnis berechnen
    riskAmount = entryPrice - stopLossPrice
    takeProfitPrice = entryPrice + (riskRewardRatio * riskAmount)
    
    // Exit-Strategie mit den berechneten TP/SL-Niveaus
    strategy.exit("Exit Long", from_entry="Long", stop=stopLossPrice, limit=takeProfitPrice)
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
    print("Running Debug BB Strategy...")
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
