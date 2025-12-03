from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from sqlalchemy.sql import func
from app.models.base import User, PaperAccount, PaperOrder, PaperPosition, PaperTrade, ActiveStrategy
from app.services.market_service import MarketService
import uuid
from decimal import Decimal

class PaperTradingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.market_service = MarketService()

    async def get_or_create_account(self, user_id: uuid.UUID) -> PaperAccount:
        result = await self.db.execute(select(PaperAccount).where(PaperAccount.user_id == user_id))
        account = result.scalars().first()
        
        if not account:
            account = PaperAccount(
                user_id=user_id,
                balance=20000.0, # 20k Start Capital
                currency="USDT"
            )
            self.db.add(account)
            await self.db.commit()
            await self.db.refresh(account)
            
        return account

    async def reset_account(self, user_id: uuid.UUID) -> PaperAccount:
        # Delete existing account (cascade deletes orders/positions)
        result = await self.db.execute(select(PaperAccount).where(PaperAccount.user_id == user_id))
        account = result.scalars().first()
        
        if account:
            await self.db.delete(account)
            await self.db.commit()
            
        return await self.get_or_create_account(user_id)

    async def place_order(self, user_id: uuid.UUID, symbol: str, side: str, amount_usdt: float, leverage: int = 1, order_type: str = "MARKET", price: float = None, stop_loss: float = None, take_profit: float = None, is_trailing_stop: bool = False, trailing_percent: float = None, strategy_id: uuid.UUID = None):
        account = await self.get_or_create_account(user_id)
        
        # 1. Get Real Price (needed for Market orders and validation)
        try:
            ohlcv = await self.market_service.get_ohlcv(symbol, timeframe="1m", limit=1)
            if not ohlcv:
                raise Exception(f"Could not fetch price for {symbol}")
            current_price = Decimal(str(ohlcv[-1]['close']))
        finally:
            await self.market_service.close()

        amount_usdt = Decimal(str(amount_usdt))
        margin = amount_usdt
        
        # 3. Check Balance
        # If strategy_id is provided, we assume funds are already reserved in locked_balance.
        # We check if locked_balance covers this trade? 
        # Actually, locked_balance is a pool. We should check if we have enough "free" locked balance?
        # But we don't track "free" locked balance vs "used" locked balance (margin).
        # We only track Total Locked.
        # When we open a position, we move funds from Cash to Margin.
        # If it's a strategy trade, it should come from Locked Balance.
        # But wait, Locked Balance represents the Strategy Capital.
        # If we open a position, the capital is still "Locked" in the strategy, just in a different form (Position vs Cash).
        # So we don't need to deduct from Locked Balance.
        # We just need to ensure the strategy has enough capital.
        # But we don't track per-strategy capital in Account. We track it in ActiveStrategy.amount.
        # So here we just trust the caller?
        # Or we check against account.locked_balance?
        
        if strategy_id:
            # Strategy Trade
            # We don't deduct from account.balance.
            # We assume the caller (background_monitor) checked ActiveStrategy limits.
            pass
        else:
            # Manual Trade
            if account.balance < margin:
                raise Exception("Insufficient balance")

        # LIMIT ORDER LOGIC
        if order_type.upper() == "LIMIT":
            if not price:
                raise Exception("Price required for Limit Order")
            
            limit_price = Decimal(str(price))
            
            # Calculate estimated quantity based on Limit Price
            position_size_usdt = margin * leverage
            quantity = position_size_usdt / limit_price
            
            order = PaperOrder(
                account_id=account.id,
                strategy_id=strategy_id,
                symbol=symbol,
                side=side.upper(),
                type="LIMIT",
                amount=margin,
                quantity=quantity,
                filled_quantity=0,
                status="OPEN",
                leverage=leverage,
                price=limit_price,
                stop_loss=Decimal(str(stop_loss)) if stop_loss else None,
                take_profit=Decimal(str(take_profit)) if take_profit else None,
                is_trailing_stop=is_trailing_stop,
                trailing_percent=Decimal(str(trailing_percent)) if trailing_percent else None
            )
            self.db.add(order)
            await self.db.commit()
            await self.db.refresh(order)
            return order

        # MARKET ORDER LOGIC
        else:
            position_size_usdt = margin * leverage
            quantity = position_size_usdt / current_price
            
            # Create Order
            order = PaperOrder(
                account_id=account.id,
                strategy_id=strategy_id,
                symbol=symbol,
                side=side.upper(),
                type="MARKET",
                amount=margin,
                quantity=quantity,
                filled_quantity=quantity,
                status="FILLED",
                leverage=leverage,
                price=current_price,
                stop_loss=Decimal(str(stop_loss)) if stop_loss else None,
                take_profit=Decimal(str(take_profit)) if take_profit else None,
                is_trailing_stop=is_trailing_stop,
                trailing_percent=Decimal(str(trailing_percent)) if trailing_percent else None
            )
            self.db.add(order)
            
            # Create Trade
            fee_rate = Decimal("0.001") # 0.1% fee
            fee = position_size_usdt * fee_rate
            
            trade = PaperTrade(
                account_id=account.id,
                order_id=order.id,
                symbol=symbol,
                side=side.upper(),
                price=current_price,
                quantity=quantity,
                fee=fee,
                fee_currency="USDT"
            )
            self.db.add(trade)
            
            # Update Account Balance
            if not strategy_id:
                account.balance -= (margin + fee)
            else:
                # For strategy, we don't touch main balance.
                # But we should probably deduct fee from somewhere?
                # If we don't deduct fee, the strategy gets free trades?
                # The fee should reduce the "Locked Balance" (Strategy Capital).
                # Yes, locked_balance -= fee.
                if account.locked_balance >= fee:
                    account.locked_balance -= fee
                else:
                    # Strategy ran out of money for fees?
                    # Just deduct what we can or go negative?
                    account.locked_balance -= fee
            
            # Update/Create Position
            result = await self.db.execute(select(PaperPosition).where(
                PaperPosition.account_id == account.id,
                PaperPosition.symbol == symbol,
                PaperPosition.strategy_id == strategy_id # Separate positions for manual vs strategy?
                # Actually, if I have a manual position on BTC and strategy buys BTC...
                # Should they merge?
                # User might want to see them separate.
                # Adding strategy_id to WHERE clause separates them.
            ))
            position = result.scalars().first()
            
            if position:
                if position.side == side.upper():
                    # Add to position
                    total_cost = (position.size * position.entry_price) + (quantity * current_price)
                    new_size = position.size + quantity
                    position.entry_price = total_cost / new_size
                    position.size = new_size
                    position.margin += margin
                    # Update TP/SL if provided (overwrite or keep? Overwrite for now)
                    if stop_loss: position.stop_loss = Decimal(str(stop_loss))
                    if take_profit: position.take_profit = Decimal(str(take_profit))
                    # Update Trailing settings
                    position.is_trailing_stop = is_trailing_stop
                    if trailing_percent: position.trailing_percent = Decimal(str(trailing_percent))
                else:
                    # Reduce/Close Position logic (simplified)
                    close_qty = min(position.size, quantity)
                    
                    if position.side == "LONG":
                        pnl = (current_price - position.entry_price) * close_qty
                    else:
                        pnl = (position.entry_price - current_price) * close_qty
                        
                    margin_released = (close_qty / position.size) * position.margin
                    
                    if not strategy_id:
                        account.balance += margin_released + pnl
                    else:
                        # Return to Locked Balance
                        account.locked_balance += margin_released + pnl
                    
                    position.size -= close_qty
                    position.margin -= margin_released
                    
                    if position.size <= 0:
                        await self.db.delete(position)
            else:
                # New Position
                position = PaperPosition(
                    account_id=account.id,
                    strategy_id=strategy_id,
                    symbol=symbol,
                    side=side.upper(),
                    size=quantity,
                    entry_price=current_price,
                    leverage=leverage,
                    margin=margin,
                    stop_loss=Decimal(str(stop_loss)) if stop_loss else None,
                    take_profit=Decimal(str(take_profit)) if take_profit else None,
                    is_trailing_stop=is_trailing_stop,
                    trailing_percent=Decimal(str(trailing_percent)) if trailing_percent else None
                )
                self.db.add(position)
    
            await self.db.commit()
            await self.db.refresh(order)
            return order

    async def check_fills(self, account_id: uuid.UUID):
        """
        Checks open limit orders against current market price.
        For MVP: Fetches current price for each symbol with open orders.
        """
        # 1. Get Open Orders
        res_ord = await self.db.execute(select(PaperOrder).where(
            PaperOrder.account_id == account_id, 
            PaperOrder.status == "OPEN"
        ))
        open_orders = res_ord.scalars().all()
        
        if not open_orders:
            return

        # Group by symbol to minimize API calls
        orders_by_symbol = {}
        for order in open_orders:
            if order.symbol not in orders_by_symbol:
                orders_by_symbol[order.symbol] = []
            orders_by_symbol[order.symbol].append(order)
            
        # 2. Check each symbol
        for symbol, orders in orders_by_symbol.items():
            try:
                # Get current price
                ohlcv = await self.market_service.get_ohlcv(symbol, timeframe="1m", limit=1)
                if not ohlcv:
                    continue
                current_price = Decimal(str(ohlcv[-1]['close']))
                
                for order in orders:
                    # Check execution conditions
                    executed = False
                    if order.side == "BUY" and current_price <= order.price:
                        executed = True
                    elif order.side == "SELL" and current_price >= order.price:
                        executed = True
                        
                    if executed:
                        # Execute Order
                        # 1. Create Trade
                        fee_rate = Decimal("0.001")
                        position_size_usdt = order.amount * order.leverage # amount is margin
                        fee = position_size_usdt * fee_rate
                        
                        trade = PaperTrade(
                            account_id=account_id,
                            order_id=order.id,
                            symbol=symbol,
                            side=order.side,
                            price=current_price, # Fill at current market price (or limit price? usually better of the two. Let's say current)
                            quantity=order.quantity,
                            fee=fee,
                            fee_currency="USDT"
                        )
                        self.db.add(trade)
                        
                        # 2. Update Order Status
                        order.status = "FILLED"
                        order.filled_quantity = order.quantity
                        order.updated_at = func.now()
                        
                        # 3. Deduct Balance (Margin + Fee)
                        # Note: In place_order we didn't deduct for Limit orders.
                        account_res = await self.db.execute(select(PaperAccount).where(PaperAccount.id == account_id))
                        account = account_res.scalars().first()
                        account.balance -= (order.amount + fee)
                        
                        # 4. Update/Create Position
                        pos_res = await self.db.execute(select(PaperPosition).where(
                            PaperPosition.account_id == account_id,
                            PaperPosition.symbol == symbol
                        ))
                        position = pos_res.scalars().first()
                        
                        if position:
                            if position.side == order.side:
                                # Add
                                total_cost = (position.size * position.entry_price) + (order.quantity * current_price)
                                new_size = position.size + order.quantity
                                position.entry_price = total_cost / new_size
                                position.size = new_size
                                position.margin += order.amount
                            else:
                                # Reduce/Close
                                close_qty = min(position.size, order.quantity)
                                if position.side == "LONG":
                                    pnl = (current_price - position.entry_price) * close_qty
                                else:
                                    pnl = (position.entry_price - current_price) * close_qty
                                
                                margin_released = (close_qty / position.size) * position.margin
                                account.balance += margin_released + pnl
                                
                                position.size -= close_qty
                                position.margin -= margin_released
                                
                                if position.size <= 0:
                                    await self.db.delete(position)
                        else:
                            # New Position
                            position = PaperPosition(
                                account_id=account_id,
                                symbol=symbol,
                                side=order.side,
                                size=order.quantity,
                                entry_price=current_price,
                                leverage=order.leverage,
                                margin=order.amount,
                                stop_loss=order.stop_loss,
                                take_profit=order.take_profit
                            )
                            self.db.add(position)
                            
            except Exception as e:
                print(f"Error checking fills for {symbol}: {e}")
                continue

        await self.db.commit()

    async def check_positions(self, account_id: uuid.UUID):
        """
        Checks open positions against current market price for SL/TP triggers.
        """
        # 1. Get Open Positions
        res_pos = await self.db.execute(select(PaperPosition).where(PaperPosition.account_id == account_id))
        positions = res_pos.scalars().all()
        
        if not positions:
            return

        # Group by symbol
        positions_by_symbol = {}
        for pos in positions:
            if pos.symbol not in positions_by_symbol:
                positions_by_symbol[pos.symbol] = []
            positions_by_symbol[pos.symbol].append(pos)
            
        # 2. Check each symbol
        for symbol, pos_list in positions_by_symbol.items():
            try:
                # Get current price
                current_price_float = await self.market_service.get_current_price(symbol)
                if not current_price_float:
                    continue
                current_price = Decimal(str(current_price_float))
                
                for pos in pos_list:
                    trigger_type = None # "STOP_LOSS" or "TAKE_PROFIT"
                    
                    # --- Trailing Stop Logic ---
                    if pos.is_trailing_stop and pos.trailing_percent and pos.stop_loss:
                        # Assume stored as percentage value (e.g. 1.0 for 1%)
                        trailing_pct_val = Decimal(str(pos.trailing_percent))
                        trailing_factor = trailing_pct_val / 100
                        
                        if pos.side in ["LONG", "BUY"]:
                            # New SL = Current Price * (1 - factor)
                            new_sl = current_price * (1 - trailing_factor)
                            if new_sl > pos.stop_loss:
                                print(f"Trailing SL Update for {symbol} LONG: {pos.stop_loss} -> {new_sl}")
                                pos.stop_loss = new_sl
                                
                        elif pos.side in ["SHORT", "SELL"]:
                            # New SL = Current Price * (1 + factor)
                            new_sl = current_price * (1 + trailing_factor)
                            if new_sl < pos.stop_loss:
                                print(f"Trailing SL Update for {symbol} SHORT: {pos.stop_loss} -> {new_sl}")
                                pos.stop_loss = new_sl

                    # Debug logging
                    # print(f"Checking {symbol} {pos.side}: Price={current_price}, SL={pos.stop_loss}, TP={pos.take_profit}")
                    
                    # Check Conditions
                    if pos.side in ["LONG", "BUY"]:
                        if pos.stop_loss and current_price <= Decimal(str(pos.stop_loss)):
                            trigger_type = "STOP_LOSS"
                        elif pos.take_profit and current_price >= Decimal(str(pos.take_profit)):
                            trigger_type = "TAKE_PROFIT"
                    elif pos.side in ["SHORT", "SELL"]:
                        if pos.stop_loss and current_price >= Decimal(str(pos.stop_loss)):
                            trigger_type = "STOP_LOSS"
                        elif pos.take_profit and current_price <= Decimal(str(pos.take_profit)):
                            trigger_type = "TAKE_PROFIT"
                            
                    if trigger_type:
                        # Execute Close
                        print(f"Triggering {trigger_type} for {symbol} {pos.side} at {current_price}")
                        
                        # 1. Calculate PnL
                        if pos.side == "LONG":
                            pnl = (current_price - pos.entry_price) * pos.size
                        else:
                            pnl = (pos.entry_price - current_price) * pos.size
                            
                        # 2. Create Closing Order (Market)
                        close_side = "SELL" if pos.side == "LONG" else "BUY"
                        
                        order = PaperOrder(
                            account_id=account_id,
                            symbol=symbol,
                            side=close_side,
                            type="MARKET",
                            amount=pos.margin, # Not exactly accurate but indicative
                            quantity=pos.size,
                            filled_quantity=pos.size,
                            status="FILLED",
                            leverage=pos.leverage,
                            price=current_price,
                            stop_loss=None,
                            take_profit=None
                        )
                        self.db.add(order)
                        await self.db.flush() # Ensure ID is generated
                        
                        # 3. Create Trade
                        fee_rate = Decimal("0.001")
                        position_value = pos.size * current_price
                        fee = position_value * fee_rate
                        
                        trade = PaperTrade(
                            account_id=account_id,
                            order_id=order.id,
                            symbol=symbol,
                            side=close_side,
                            price=current_price,
                            quantity=pos.size,
                            fee=fee,
                            fee_currency="USDT",
                            realized_pnl=pnl
                        )
                        self.db.add(trade)
                        
                        # 4. Update Account Balance
                        # Balance += Margin + PnL - Fee
                        # (Margin was deducted at open, now we return it + profit/loss)
                        
                        account_res = await self.db.execute(select(PaperAccount).where(PaperAccount.id == account_id))
                        account = account_res.scalars().first()
                        
                        if pos.strategy_id:
                            account.locked_balance += pos.margin + pnl - fee
                            
                            # Update ActiveStrategy current_capital
                            # We need to fetch it first
                            active_res = await self.db.execute(select(ActiveStrategy).where(ActiveStrategy.id == pos.strategy_id))
                            active = active_res.scalars().first()
                            if active:
                                # current_capital should reflect the total equity.
                                # Before this trade, it was X.
                                # Now we closed a position.
                                # The position had Margin M.
                                # We got back M + PnL - Fee.
                                # So Net Change = PnL - Fee.
                                if active.current_capital is None:
                                    active.current_capital = active.amount # Fallback
                                
                                active.current_capital += pnl - fee
                                self.db.add(active)
                        else:
                            account.balance += pos.margin + pnl - fee
                        
                        # 5. Delete Position
                        await self.db.delete(pos)
                        
            except Exception as e:
                print(f"Error checking positions for {symbol}: {e}")
                continue
                
        await self.db.commit()

    async def get_portfolio(self, user_id: uuid.UUID):
        account = await self.get_or_create_account(user_id)
        
        # Check for fills before returning
        await self.check_fills(account.id)
        # Check for SL/TP triggers
        await self.check_positions(account.id)
        
        # Fetch Positions
        res_pos = await self.db.execute(select(PaperPosition).where(PaperPosition.account_id == account.id))
        positions = res_pos.scalars().all()
        
        # Fetch Open Orders (Limit orders, if we had them)
        res_ord = await self.db.execute(select(PaperOrder).where(
            PaperOrder.account_id == account.id, 
            PaperOrder.status == "OPEN"
        ))
        orders = res_ord.scalars().all()
        
        # Fetch History
        res_hist = await self.db.execute(select(PaperOrder).where(
            PaperOrder.account_id == account.id,
            PaperOrder.status != "OPEN"
        ).order_by(PaperOrder.created_at.desc()).limit(50))
        history = res_hist.scalars().all()
        
        return {
            "balance": account.balance,
            "positions": positions,
            "orders": orders,
            "history": history
        }
