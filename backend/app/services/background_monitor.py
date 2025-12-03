import asyncio
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.base import User, ActiveStrategy, Strategy, PaperPosition
from app.services.paper_trading import PaperTradingService
from app.services.market_service import MarketService
from app.services.pine_transpiler.parser import parse_pine_script
from app.services.pine_transpiler.interpreter import execute_pine_script
import pandas as pd
import numpy as np
import traceback
import uuid

async def monitor_positions():
    """
    Background task to monitor:
    1. Open positions for SL/TP triggers.
    2. Active strategies for new trade signals.
    Runs every 3 seconds.
    """
    print("Starting background monitor...")
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                # 1. Monitor Positions (SL/TP)
                # We need to iterate users to check their positions
                result = await db.execute(select(User))
                users = result.scalars().all()
                
                service = PaperTradingService(db)
                
                for user in users:
                    try:
                        account = await service.get_or_create_account(user.id)
                        await service.check_positions(account.id)
                        await service.check_fills(account.id)
                    except Exception as e:
                        # print(f"Error monitoring user {user.id}: {e}")
                        continue
                
                # 2. Execute Active Strategies
                # Fetch all running active strategies
                result_strategies = await db.execute(
                    select(ActiveStrategy, Strategy)
                    .join(Strategy, ActiveStrategy.strategy_id == Strategy.id)
                    .where(ActiveStrategy.status == "RUNNING")
                )
                active_strategies = result_strategies.all()
                
                # Group by symbol to optimize market data fetching? 
                # For now, simple loop is safer to avoid complexity.
                
                # We need a MarketService instance
                market_service = MarketService()
                
                try:
                    for active, strategy in active_strategies:
                        try:
                            # Fetch Market Data
                            ohlcv = await market_service.get_ohlcv(active.symbol, active.timeframe, limit=200)
                            if not ohlcv:
                                continue
                                
                            df = pd.DataFrame(ohlcv)
                            df['timestamp'] = pd.to_datetime(df['timestamp'])
                            df.set_index('timestamp', inplace=True)
                            
                            market_data = {
                                "open": df['open'],
                                "high": df['high'],
                                "low": df['low'],
                                "close": df['close'],
                                "volume": df['volume']
                            }
                            
                            # Parse & Execute Script
                            parsed = parse_pine_script(strategy.source_code)
                            condition_results, _ = execute_pine_script(parsed, market_data)
                            
                            # Check last candle signals
                            # We look at the LAST completed candle or current?
                            # Usually strategies run on 'close', so we look at the last closed candle.
                            # But get_ohlcv might return the current forming candle as the last one.
                            # Let's assume the last row is the one to check.
                            
                            last_idx = df.index[-1]
                            
                            signal_found = None # 'buy' or 'sell' or 'exit'
                            
                            # Check for Entry Signals
                            if "strategy.entry" in condition_results:
                                # This returns a Series of "Long" or "Short" or None/NaN
                                entry_series = condition_results["strategy.entry"]
                                last_val = entry_series.iloc[-1]
                                if last_val == "Long":
                                    signal_found = "buy"
                                elif last_val == "Short":
                                    signal_found = "sell"
                                    
                            # Check for specific condition variables if strategy.entry not used directly
                            # (Depends on how parse_pine_script maps them. Currently it maps 'buy_condition' etc if named so)
                            # But let's rely on what execute_pine_script returns.
                            # It returns a dict of condition names -> Series (bool).
                            
                            if not signal_found:
                                for name, series in condition_results.items():
                                    if isinstance(series, pd.Series) and series.dtype == bool:
                                        if series.iloc[-1]: # If true at last index
                                            if "buy" in name.lower() or "long" in name.lower():
                                                signal_found = "buy"
                                            elif "sell" in name.lower() or "short" in name.lower():
                                                signal_found = "sell"
                            
                            if signal_found:
                                # Check existing position
                                account = await service.get_or_create_account(active.user_id)
                                
                                # Check if we already have a position for this symbol
                                pos_res = await db.execute(select(PaperPosition).where(
                                    PaperPosition.account_id == account.id,
                                    PaperPosition.symbol == active.symbol
                                ))
                                position = pos_res.scalars().first()
                                
                                # Execution Logic
                                if signal_found == "buy":
                                    if not position:
                                        # Open LONG
                                        print(f"Strategy {active.id} triggering BUY on {active.symbol}")
                                        await service.place_order(
                                            user_id=active.user_id,
                                            symbol=active.symbol,
                                            side="BUY",
                                            amount_usdt=float(active.amount),
                                            leverage=1,
                                            order_type="MARKET",
                                            strategy_id=active.id
                                        )
                                    elif position.side == "SHORT":
                                        # Flip: Close Short, Open Long
                                        print(f"Strategy {active.id} flipping to BUY on {active.symbol}")
                                        await service.place_order(
                                            user_id=active.user_id,
                                            symbol=active.symbol,
                                            side="BUY",
                                            amount_usdt=float(position.margin), # Close Short
                                            order_type="MARKET",
                                            strategy_id=active.id
                                        )
                                        await service.place_order(
                                            user_id=active.user_id,
                                            symbol=active.symbol,
                                            side="BUY",
                                            amount_usdt=float(active.amount), # Open Long
                                            order_type="MARKET",
                                            strategy_id=active.id
                                        )

                                elif signal_found == "sell":
                                    if not position:
                                        # Open SHORT
                                        print(f"Strategy {active.id} triggering SELL on {active.symbol}")
                                        await service.place_order(
                                            user_id=active.user_id,
                                            symbol=active.symbol,
                                            side="SELL",
                                            amount_usdt=float(active.amount),
                                            leverage=1,
                                            order_type="MARKET",
                                            strategy_id=active.id
                                        )
                                    elif position.side == "LONG":
                                        # Flip: Close Long, Open Short
                                        print(f"Strategy {active.id} flipping to SELL on {active.symbol}")
                                        await service.place_order(
                                            user_id=active.user_id,
                                            symbol=active.symbol,
                                            side="SELL",
                                            amount_usdt=float(position.margin), # Close Long
                                            order_type="MARKET",
                                            strategy_id=active.id
                                        )
                                        await service.place_order(
                                            user_id=active.user_id,
                                            symbol=active.symbol,
                                            side="SELL",
                                            amount_usdt=float(active.amount), # Open Short
                                            order_type="MARKET",
                                            strategy_id=active.id
                                        )
                                        
                        except Exception as e:
                            print(f"Error executing strategy {active.id}: {e}")
                            # traceback.print_exc()
                            continue
                            
                finally:
                    await market_service.close()
                    await service.market_service.close() # Ensure service's market service is also closed
                
        except Exception as e:
            print(f"Critical error in background monitor: {e}")
            # traceback.print_exc()
            
        await asyncio.sleep(3) # Check every 3 seconds
