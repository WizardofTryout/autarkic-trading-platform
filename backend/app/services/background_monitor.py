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
                            signals, context = execute_pine_script(parsed, market_data)
                            
                            if signals:
                                # Check existing position
                                account = await service.get_or_create_account(active.user_id)
                                
                                # Check if we already have a position for this symbol
                                pos_res = await db.execute(select(PaperPosition).where(
                                    PaperPosition.account_id == account.id,
                                    PaperPosition.symbol == active.symbol,
                                    PaperPosition.strategy_id == active.id
                                ))
                                position = pos_res.scalars().first()
                                
                                for signal in signals:
                                    action = signal["action"] # BUY, SELL, CLOSE
                                    
                                    # --- Dynamic Risk Calculation ---
                                    # Defaults
                                    amount_usdt = float(active.amount)
                                    stop_loss_price = None
                                    take_profit_price = None
                                    
                                    # Get current price (approximate from last close for calculation)
                                    current_price = float(market_data["close"].iloc[-1])
                                    
                                    if active.stop_loss_percent and float(active.stop_loss_percent) > 0:
                                        # 1. Calculate Stop Loss Price
                                        sl_dist = current_price * float(active.stop_loss_percent)
                                        
                                        if action == "BUY":
                                            stop_loss_price = current_price - sl_dist
                                        elif action == "SELL":
                                            stop_loss_price = current_price + sl_dist
                                            
                                        # 2. Calculate Position Size based on Risk
                                        # Risk Amount = Capital * Risk Per Trade (e.g. 1000 * 0.01 = 10$)
                                        # Loss per Unit = Entry - SL = sl_dist
                                        # Position Size (Units) = Risk Amount / sl_dist
                                        # Position Size (USDT) = Units * Entry
                                        
                                        if active.risk_per_trade and float(active.risk_per_trade) > 0:
                                            risk_amount = float(active.current_capital or active.amount) * float(active.risk_per_trade)
                                            position_units = risk_amount / sl_dist
                                            calculated_amount = position_units * current_price
                                            
                                            # Cap at available capital (no leverage for now)
                                            max_capital = float(active.current_capital or active.amount)
                                            amount_usdt = min(calculated_amount, max_capital)
                                            
                                            print(f"Risk Calc: Risk ${risk_amount:.2f}, SL Dist {sl_dist:.2f}, Calc Size ${calculated_amount:.2f}, Final Size ${amount_usdt:.2f}")

                                    if active.risk_reward_ratio and float(active.risk_reward_ratio) > 0 and stop_loss_price:
                                        # 3. Calculate Take Profit
                                        # Reward = Risk * Ratio
                                        # TP Dist = SL Dist * Ratio
                                        sl_dist = abs(current_price - stop_loss_price)
                                        tp_dist = sl_dist * float(active.risk_reward_ratio)
                                        
                                        if action == "BUY":
                                            take_profit_price = current_price + tp_dist
                                        elif action == "SELL":
                                            take_profit_price = current_price - tp_dist

                                    # --- Execution ---
                                    
                                    if action == "BUY":
                                        if not position:
                                            # Open LONG
                                            print(f"Strategy {active.id} triggering BUY on {active.symbol}")
                                            await service.place_order(
                                                user_id=active.user_id,
                                                symbol=active.symbol,
                                                side="BUY",
                                                amount_usdt=amount_usdt,
                                                leverage=1,
                                                order_type="MARKET",
                                                strategy_id=active.id,
                                                stop_loss=stop_loss_price,
                                                take_profit=take_profit_price,
                                                is_trailing_stop=active.use_trailing_stop,
                                                trailing_percent=float(active.trailing_stop_percent) if active.trailing_stop_percent else None
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
                                                amount_usdt=amount_usdt, # Open Long with calculated size
                                                order_type="MARKET",
                                                strategy_id=active.id,
                                                stop_loss=stop_loss_price,
                                                take_profit=take_profit_price,
                                                is_trailing_stop=active.use_trailing_stop,
                                                trailing_percent=float(active.trailing_stop_percent) if active.trailing_stop_percent else None
                                            )
                                            
                                    elif action == "SELL":
                                        if not position:
                                            # Open SHORT
                                            print(f"Strategy {active.id} triggering SELL on {active.symbol}")
                                            await service.place_order(
                                                user_id=active.user_id,
                                                symbol=active.symbol,
                                                side="SELL",
                                                amount_usdt=amount_usdt,
                                                leverage=1,
                                                order_type="MARKET",
                                                strategy_id=active.id,
                                                stop_loss=stop_loss_price,
                                                take_profit=take_profit_price,
                                                is_trailing_stop=active.use_trailing_stop,
                                                trailing_percent=float(active.trailing_stop_percent) if active.trailing_stop_percent else None
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
                                                amount_usdt=amount_usdt, # Open Short with calculated size
                                                order_type="MARKET",
                                                strategy_id=active.id,
                                                stop_loss=stop_loss_price,
                                                take_profit=take_profit_price,
                                                is_trailing_stop=active.use_trailing_stop,
                                                trailing_percent=float(active.trailing_stop_percent) if active.trailing_stop_percent else None
                                            )
                                            
                                    elif action == "CLOSE":
                                        if position:
                                            print(f"Strategy {active.id} triggering CLOSE on {active.symbol}")
                                            # Close Position
                                            side_to_close = "SELL" if position.side == "LONG" else "BUY"
                                            await service.place_order(
                                                user_id=active.user_id,
                                                symbol=active.symbol,
                                                side=side_to_close,
                                                amount_usdt=float(position.margin),
                                                order_type="MARKET",
                                                strategy_id=active.id
                                            )

                        except Exception as e:
                            print(f"Error executing strategy {active.id}: {e}")
                            traceback.print_exc()
                            continue
                            
                finally:
                    await market_service.close()
                    await service.market_service.close() # Ensure service's market service is also closed
                
        except Exception as e:
            print(f"Critical error in background monitor: {e}")
            # traceback.print_exc()
            
        await asyncio.sleep(3) # Check every 3 seconds
