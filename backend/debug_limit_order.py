import asyncio
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.services.paper_trading import PaperTradingService
from app.models.base import User, PaperAccount

# Setup DB
engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class MockMarketService:
    def __init__(self, price=90972.0):
        self.price = price
        
    async def get_ohlcv(self, symbol, timeframe="1m", limit=1):
        # Return a structure matching what check_fills expects
        return [{'close': self.price}]
        
    async def close(self):
        pass

async def run_debug():
    async with AsyncSessionLocal() as db:
        print("--- Starting Debug Limit Order ---")
        
        # 1. Get or Create User
        from sqlalchemy import select
        result = await db.execute(select(User).limit(1))
        user = result.scalars().first()
        if not user:
            print("No user found, cannot run test.")
            return

        print(f"Using User: {user.username} ({user.id})")
        
        service = PaperTradingService(db)
        # Ensure account exists
        account = await service.get_or_create_account(user.id)
            
        print(f"Initial Balance: {account.balance}")

        # 2. MOCK Market Service for Place Order
        # Scenario: Market is 90972. User places Sell Limit @ 92000.
        current_market_price = 90972.0
        service.market_service = MockMarketService(price=current_market_price)
        
        symbol = "BTC/USDT"
        side = "SELL"
        amount = 100.0
        leverage = 5
        order_type = "LIMIT"
        limit_price = 92000.0
        
        print(f"Scenario: Market {current_market_price}, Placing SELL LIMIT @ {limit_price}")
        
        try:
            order = await service.place_order(
                user_id=user.id,
                symbol=symbol,
                side=side,
                amount_usdt=amount,
                leverage=leverage,
                order_type=order_type,
                price=limit_price
            )
            print(f"Order Placed. ID: {order.id}, Status: {order.status}")
        except Exception as e:
            print(f"Place Order Failed: {e}")
            return

        # 3. Verify Status (Should be OPEN)
        if order.status != "OPEN":
            print(f"FAILURE: Order should be OPEN, but is {order.status}")
        else:
            print("SUCCESS: Order is initially OPEN.")

        # 4. Run check_fills with SAME Price (Should NOT Fill)
        # Re-mock service if needed (place_order might have closed it, but our mock close does nothing)
        # service.market_service.price is already 90972.0
        
        print(f"Running check_fills with Price = {service.market_service.price}...")
        await service.check_fills(account.id)
        
        # Refresh order
        await db.refresh(order)
        if order.status != "OPEN":
             print(f"FAILURE: Order executed at {service.market_service.price} but Limit was {limit_price} (SELL)")
        else:
             print("SUCCESS: Order remained OPEN at lower price.")
             
        # 5. Run check_fills with HIGHER Price (Should Fill)
        new_price = 93000.0
        print(f"Running check_fills with Price = {new_price}...")
        service.market_service.price = new_price
        
        await service.check_fills(account.id)
        
        await db.refresh(order)
        if order.status == "FILLED":
            print("SUCCESS: Order filled when price crossed limit.")
        else:
            print(f"FAILURE: Order did NOT fill. Status: {order.status}")

        # Cleanup (optional, or just leave it)
        # await service.cancel_order(user.id, order.id)

if __name__ == "__main__":
    asyncio.run(run_debug())
