import pandas as pd
from datetime import datetime
from app.services.pine_transpiler.parser import parse_pine_script
from app.services.pine_transpiler.interpreter import execute_pine_script
from app.services.market_service import MarketService

class BacktestEngine:
    def __init__(self):
        self.market_service = MarketService()

    async def run_backtest(self, script: str, symbol: str, timeframe: str, start_date: datetime, end_date: datetime, initial_capital: float = 10000.0, take_profit: float = 0, stop_loss: float = 0):
        # 1. Fetch Historical Data
        print(f"Fetching historical data for {symbol} from {start_date} to {end_date}...")
        ohlcv_data = await self.market_service.fetch_historical_data_range(symbol, timeframe, start_date, end_date)
        
        if not ohlcv_data:
            return {"error": "No data found for the specified range"}

        # Convert to DataFrame
        df = pd.DataFrame(ohlcv_data)
        # Ensure timestamp is datetime
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
            signals_list, context = execute_pine_script(parsed, market_data)
            
            # Convert signals list to a lookup dict for faster access: timestamp -> list of actions
            signal_map = {}
            for sig in signals_list:
                ts = sig["timestamp"]
                # Ensure ts is Timestamp for consistent lookup
                if isinstance(ts, str):
                    ts = pd.to_datetime(ts)
                if ts not in signal_map:
                    signal_map[ts] = []
                signal_map[ts].append(sig)
                
        except Exception as e:
            return {"error": f"Runtime Error: {str(e)}"}

        # 3. Simulate Trades
        print("Simulating trades...")
        
        capital = initial_capital
        equity_curve = []
        trades = []
        position = None # None, 'LONG', 'SHORT'
        entry_price = 0
        entry_time = None
        entry_size = 0 # Amount of asset
        
        # Fee configuration (e.g., 0.1% per trade)
        fee_rate = 0.001 
        
        # Simulation Loop
        # We iterate through the dataframe to simulate time
        print(f"DEBUG: df.index type: {df.index.dtype}")
        for timestamp, row in df.iterrows():
            # Force conversion to be absolutely sure
            timestamp = pd.to_datetime(timestamp)
            
            current_price = row['close']
            high_price = row['high']
            low_price = row['low']
            
            # 1. Check TP/SL for existing position
            if position == 'LONG':
                # Take Profit: High >= Entry * (1 + TP/100)
                if take_profit > 0 and high_price >= entry_price * (1 + take_profit/100):
                    exit_price = entry_price * (1 + take_profit/100)
                    pnl = (exit_price - entry_price) * entry_size
                    fee = (exit_price * entry_size) * fee_rate
                    pnl -= fee
                    capital += pnl
                    trades.append({
                        "type": "LONG",
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "entry_time": entry_time,
                        "exit_time": timestamp,
                        "pnl": pnl,
                        "pnl_percent": (pnl / (entry_price * entry_size)) * 100,
                        "status": "Take Profit"
                    })
                    position = None
                    entry_size = 0
                
                # Stop Loss: Low <= Entry * (1 - SL/100)
                elif stop_loss > 0 and low_price <= entry_price * (1 - stop_loss/100):
                    exit_price = entry_price * (1 - stop_loss/100)
                    pnl = (exit_price - entry_price) * entry_size
                    fee = (exit_price * entry_size) * fee_rate
                    pnl -= fee
                    capital += pnl
                    trades.append({
                        "type": "LONG",
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "entry_time": entry_time,
                        "exit_time": timestamp,
                        "pnl": pnl,
                        "pnl_percent": (pnl / (entry_price * entry_size)) * 100,
                        "status": "Stop Loss"
                    })
                    position = None
                    entry_size = 0

            elif position == 'SHORT':
                # Take Profit: Low <= Entry * (1 - TP/100)
                if take_profit > 0 and low_price <= entry_price * (1 - take_profit/100):
                    exit_price = entry_price * (1 - take_profit/100)
                    pnl = (entry_price - exit_price) * entry_size
                    fee = (exit_price * entry_size) * fee_rate
                    pnl -= fee
                    capital += pnl
                    trades.append({
                        "type": "SHORT",
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "entry_time": entry_time,
                        "exit_time": timestamp,
                        "pnl": pnl,
                        "pnl_percent": (pnl / (entry_price * entry_size)) * 100,
                        "status": "Take Profit"
                    })
                    position = None
                    entry_size = 0

                # Stop Loss: High >= Entry * (1 + SL/100)
                elif stop_loss > 0 and high_price >= entry_price * (1 + stop_loss/100):
                    exit_price = entry_price * (1 + stop_loss/100)
                    pnl = (entry_price - exit_price) * entry_size
                    fee = (exit_price * entry_size) * fee_rate
                    pnl -= fee
                    capital += pnl
                    trades.append({
                        "type": "SHORT",
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "entry_time": entry_time,
                        "exit_time": timestamp,
                        "pnl": pnl,
                        "pnl_percent": (pnl / (entry_price * entry_size)) * 100,
                        "status": "Stop Loss"
                    })
                    position = None
                    entry_size = 0

            # 2. Record equity (mark to market)
            current_equity = capital
            if position == 'LONG':
                current_equity += (current_price - entry_price) * entry_size
            elif position == 'SHORT':
                current_equity += (entry_price - current_price) * entry_size
            
            equity_curve.append({
                "time": timestamp.timestamp(),
                "value": current_equity
            })

            # 3. Check for Signals at this timestamp (only if no TP/SL was triggered and position is still open or new signal)
            if timestamp in signal_map:
                for sig in signal_map[timestamp]:
                    action = sig["action"]
                    
                    if action == "BUY":
                        if position == 'SHORT':
                            # Close Short
                            pnl = (entry_price - current_price) * entry_size
                            # Deduct Fee
                            fee = (current_price * entry_size) * fee_rate
                            pnl -= fee
                            capital += pnl
                            
                            trades.append({
                                "type": "SHORT",
                                "entry_price": entry_price,
                                "exit_price": current_price,
                                "entry_time": entry_time,
                                "exit_time": timestamp,
                                "pnl": pnl,
                                "pnl_percent": (pnl / (entry_price * entry_size)) * 100 if entry_price > 0 else 0
                            })
                            position = None
                            entry_size = 0
                        
                        if position is None:
                            # Open Long
                            position = 'LONG'
                            entry_price = current_price
                            entry_time = timestamp
                            # Size: 95% of capital
                            entry_size = (capital * 0.95) / entry_price
                            # Deduct Fee
                            capital -= (entry_price * entry_size) * fee_rate
                            
                    elif action == "SELL":
                        if position == 'LONG':
                            # Close Long
                            pnl = (current_price - entry_price) * entry_size
                            # Deduct Fee
                            fee = (current_price * entry_size) * fee_rate
                            pnl -= fee
                            capital += pnl
                            
                            trades.append({
                                "type": "LONG",
                                "entry_price": entry_price,
                                "exit_price": current_price,
                                "entry_time": entry_time,
                                "exit_time": timestamp,
                                "pnl": pnl,
                                "pnl_percent": (pnl / (entry_price * entry_size)) * 100 if entry_price > 0 else 0
                            })
                            position = None
                            entry_size = 0
                            
                        if position is None:
                            # Open Short
                            position = 'SHORT'
                            entry_price = current_price
                            entry_time = timestamp
                            # Size: 95% of capital
                            entry_size = (capital * 0.95) / entry_price
                            # Deduct Fee
                            capital -= (entry_price * entry_size) * fee_rate

                    elif action == "CLOSE":
                        if position:
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
                                "type": position,
                                "entry_price": entry_price,
                                "exit_price": exit_price,
                                "entry_time": entry_time,
                                "exit_time": timestamp,
                                "pnl": pnl,
                                "pnl_percent": (pnl / (entry_price * entry_size)) * 100 if entry_price > 0 else 0
                            })
                            position = None
                            entry_size = 0

        # End of Simulation Loop - Close any open position
        if position is not None:
            # Force close at last price
            last_price = df.iloc[-1]['close']
            last_time = df.index[-1]
            
            pnl = 0
            if position == 'LONG':
                pnl = (last_price - entry_price) * entry_size
            elif position == 'SHORT':
                pnl = (entry_price - last_price) * entry_size
            
            # Deduct Fee
            fee = (last_price * entry_size) * fee_rate
            pnl -= fee
            capital += pnl
            
            trades.append({
                "type": position,
                "entry_price": entry_price,
                "exit_price": last_price,
                "entry_time": entry_time,
                "exit_time": last_time,
                "pnl": pnl,
                "pnl_percent": (pnl / (entry_price * entry_size)) * 100 if entry_price > 0 else 0,
                "status": "Closed (End of Data)"
            })

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
