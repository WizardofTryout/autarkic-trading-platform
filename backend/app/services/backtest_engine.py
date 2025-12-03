import pandas as pd
from datetime import datetime
from app.services.pine_transpiler.parser import parse_pine_script
from app.services.pine_transpiler.interpreter import execute_pine_script
from app.services.market_service import MarketService

class BacktestEngine:
    def __init__(self):
        self.market_service = MarketService()

    async def run_backtest(self, script: str, symbol: str, timeframe: str, start_date: datetime, end_date: datetime, initial_capital: float = 10000.0):
        # 1. Fetch Historical Data
        print(f"Fetching historical data for {symbol} from {start_date} to {end_date}...")
        ohlcv_data = await self.market_service.fetch_historical_data_range(symbol, timeframe, start_date, end_date)
        
        if not ohlcv_data:
            return {"error": "No data found for the specified range"}

        # Convert to DataFrame
        df = pd.DataFrame(ohlcv_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        
        market_data = {
            "open": df['open'],
            "high": df['high'],
            "low": df['low'],
            "close": df['close'],
            "volume": df['volume']
        }

        # 2. Generate Signals
        print("Executing Pine Script...")
        try:
            parsed = parse_pine_script(script)
            # execute_pine_script returns (live_signals_list, context_dict)
            # We only need context for backtesting to get the full series
            _, context = execute_pine_script(parsed, market_data)
        except Exception as e:
            return {"error": f"Script execution failed: {str(e)}"}

        # 3. Simulate Trades
        print("Simulating trades...")
        trades = []
        equity_curve = []
        
        capital = initial_capital
        position = None # None, 'LONG', 'SHORT'
        entry_price = 0
        entry_time = None
        entry_size = 0 # Amount of asset
        
        # Fee configuration (e.g., 0.1% per trade)
        fee_rate = 0.001 
        
        # Combine signals into a single timeline
        # We need to iterate through the dataframe index to simulate time
        
        # Identify signal columns from parsed strategy calls
        long_signals = pd.Series(False, index=df.index)
        short_signals = pd.Series(False, index=df.index)
        close_signals = pd.Series(False, index=df.index)

        print(f"Strategy Calls: {parsed.get('strategy_calls', [])}")
        for call in parsed.get("strategy_calls", []):
            func = call["function"]
            args = call["args"]
            
            condition = None
            direction = "long" # default
            
            for arg in args:
                if arg == "strategy.long": direction = "long"
                elif arg == "strategy.short": direction = "short"
                elif arg.startswith("when="):
                    cond_name = arg.split("=")[1]
                    condition = context.get(cond_name)
                    print(f"Condition '{cond_name}' found in context: {condition is not None}")
                    if condition is not None and isinstance(condition, pd.Series):
                        print(f"Condition '{cond_name}' True count: {condition.sum()}")
            
            if condition is not None and isinstance(condition, pd.Series):
                # Fill NaNs with False
                condition = condition.fillna(False)
                
                if func == "entry":
                    if direction == "long":
                        long_signals = long_signals | condition
                    else:
                        short_signals = short_signals | condition
                elif func == "close":
                    close_signals = close_signals | condition
        
        # Ensure boolean series
        if not isinstance(long_signals, pd.Series): long_signals = pd.Series(False, index=df.index)
        if not isinstance(short_signals, pd.Series): short_signals = pd.Series(False, index=df.index)
        if not isinstance(close_signals, pd.Series): close_signals = pd.Series(False, index=df.index)

        for timestamp, row in df.iterrows():
            current_price = row['close']
            
            # Record equity (mark to market)
            current_equity = capital
            if position == 'LONG':
                current_equity += (current_price - entry_price) * entry_size
            elif position == 'SHORT':
                current_equity += (entry_price - current_price) * entry_size
            
            equity_curve.append({
                "time": timestamp.timestamp(),
                "value": current_equity
            })

            # Check Signals
            is_long = long_signals.get(timestamp, False)
            is_short = short_signals.get(timestamp, False)
            is_close = close_signals.get(timestamp, False)
            
            # Debug logging for first few iterations
            if len(equity_curve) < 5:
                print(f"Time: {timestamp}, Price: {current_price}, Long: {is_long}, Short: {is_short}, Close: {is_close}")

            # Close Logic
            if position and (is_close or (position == 'LONG' and is_short) or (position == 'SHORT' and is_long)):
                # Close Position
                exit_price = current_price
                pnl = 0
                if position == 'LONG':
                    pnl = (exit_price - entry_price) * entry_size
                elif position == 'SHORT':
                    pnl = (entry_price - exit_price) * entry_size
                
                # Deduct Fee
                fee = (exit_price * entry_size) * fee_rate
                pnl -= fee
                capital += pnl
                
                trades.append({
                    "entry_time": entry_time,
                    "exit_time": timestamp,
                    "type": position,
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "pnl": pnl,
                    "pnl_percent": (pnl / (entry_price * entry_size)) * 100 if entry_price > 0 else 0
                })
                
                position = None
                entry_size = 0
            
            # Entry Logic
            if not position:
                if is_long:
                    position = 'LONG'
                    entry_price = current_price
                    entry_time = timestamp
                    # Simple sizing: Use 95% of capital (leave room for fees)
                    entry_size = (capital * 0.95) / entry_price
                    # Deduct Entry Fee
                    capital -= (entry_price * entry_size) * fee_rate
                elif is_short:
                    position = 'SHORT'
                    entry_price = current_price
                    entry_time = timestamp
                    entry_size = (capital * 0.95) / entry_price
                    capital -= (entry_price * entry_size) * fee_rate

        # 4. Calculate Metrics
        total_trades = len(trades)
        winning_trades = len([t for t in trades if t['pnl'] > 0])
        losing_trades = len([t for t in trades if t['pnl'] <= 0])
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        net_profit = capital - initial_capital
        total_return = (net_profit / initial_capital) * 100
        
        # Max Drawdown
        peak = initial_capital
        max_drawdown = 0
        for point in equity_curve:
            val = point['value']
            if val > peak:
                peak = val
            dd = (peak - val) / peak * 100
            if dd > max_drawdown:
                max_drawdown = dd

        results = {
            "metrics": {
                "initial_capital": initial_capital,
                "final_capital": capital,
                "net_profit": net_profit,
                "total_return_percent": total_return,
                "total_trades": total_trades,
                "win_rate": win_rate,
                "max_drawdown_percent": max_drawdown
            },
            "trades": [{k: v.isoformat() if isinstance(v, datetime) else v for k, v in t.items()} for t in trades],
            "equity_curve": equity_curve
        }
        
        return results

    async def close(self):
        await self.market_service.close()
