import asyncio
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.base import User
from app.services.paper_trading import PaperTradingService

async def monitor_positions():
    """
    Background task to monitor all open positions for SL/TP triggers.
    Runs every 3 seconds.
    """
    print("Starting background position monitor...")
    
    # We need to manage the MarketService lifecycle carefully.
    # Ideally, it should be a singleton or long-lived.
    # For now, let's instantiate it inside the loop but keep it alive for the batch?
    # Actually, PaperTradingService creates its own MarketService instance.
    # We should modify PaperTradingService to accept an existing MarketService or manage it better.
    # For this quick fix, let's just accept the overhead but ensure we close it.
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User))
                users = result.scalars().all()
                
                # Create one service instance per loop iteration to share the DB session
                # But PaperTradingService creates a NEW MarketService internally.
                # This is the bottleneck.
                
                service = PaperTradingService(db)
                
                for user in users:
                    try:
                        account = await service.get_or_create_account(user.id)
                        await service.check_positions(account.id)
                    except Exception as e:
                        # print(f"Error monitoring user {user.id}: {e}")
                        continue
                
                # Explicitly close the market service connection after the batch
                await service.market_service.close()
                        
        except Exception as e:
            print(f"Critical error in background monitor: {e}")
            
        await asyncio.sleep(1) # Check every 1 second for faster reaction
