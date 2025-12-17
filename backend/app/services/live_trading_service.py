"""
Live Trading Service - Gateway for Bitget Live Trading.

This service mirrors the PaperTradingService interface but routes orders
to the actual Bitget exchange via BitgetService.

CRITICAL SAFETY:
- All orders go through rate limiting via BitgetService
- API keys are decrypted per-request, NEVER stored in memory
- Order confirmation requires actual exchange response

ARCHITECTURE:
    TradingAgentInstance
          |
          v
    [mode == 'LIVE']? --> LiveTradingService --> BitgetService --> Bitget API
          |
    [mode == 'PAPER']? --> PaperTradingService --> Database
"""

import logging
from decimal import Decimal
from typing import Dict, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.base import User, UserSecret
from app.services.exchanges import BitgetService
from app.core.security import decrypt_api_key  # Assumes this exists

logger = logging.getLogger(__name__)


class LiveTradingService:
    """
    Gateway for Live Bitget Trading.
    
    Usage:
        service = LiveTradingService(db, user_id)
        await service.initialize()  # Loads and validates API keys
        order = await service.place_order(...)
    """
    
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self._bitget: Optional[BitgetService] = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        Load and validate Bitget API keys for the user.
        Must be called before any trading operations.
        
        Returns:
            True if keys are valid and ready for trading
            
        Raises:
            Exception if keys are missing or invalid
        """
        if self._initialized:
            return True
        
        # Fetch user's Bitget API credentials
        result = await self.db.execute(
            select(UserSecret).where(
                UserSecret.user_id == self.user_id,
                UserSecret.provider == 'bitget'
            )
        )
        secrets = result.scalars().all()
        
        if not secrets:
            raise Exception("No Bitget API keys found. Please add them in Settings.")
        
        # We need: API Key, Secret, Passphrase
        # Stored format: key_name contains type, encrypted_value contains the actual key
        credentials = {}
        for secret in secrets:
            # Decrypt the value
            try:
                decrypted = decrypt_api_key(secret.encrypted_value)
                # key_name format: "bitget_api_key", "bitget_secret", "bitget_passphrase"
                key_type = secret.key_name.lower()
                if 'api_key' in key_type or 'apikey' in key_type:
                    credentials['api_key'] = decrypted
                elif 'secret' in key_type:
                    credentials['secret'] = decrypted
                elif 'passphrase' in key_type:
                    credentials['passphrase'] = decrypted
            except Exception as e:
                logger.error(f"Failed to decrypt key {secret.key_name}: {e}")
                continue
        
        # Validate we have all required credentials
        if not all(k in credentials for k in ['api_key', 'secret', 'passphrase']):
            missing = [k for k in ['api_key', 'secret', 'passphrase'] if k not in credentials]
            raise Exception(f"Missing Bitget credentials: {missing}")
        
        # Initialize BitgetService
        self._bitget = BitgetService(
            api_key=credentials['api_key'],
            secret=credentials['secret'],
            passphrase=credentials['passphrase']
        )
        
        # Validate keys by making a lightweight API call
        is_valid = await self._bitget.validate_keys()
        if not is_valid:
            await self._bitget.close()
            self._bitget = None
            raise Exception("Bitget API key validation failed. Check your credentials.")
        
        self._initialized = True
        logger.info(f"LiveTradingService initialized for user {self.user_id}")
        return True
    
    async def close(self):
        """Close the BitgetService connection."""
        if self._bitget:
            await self._bitget.close()
            self._bitget = None
            self._initialized = False
    
    def _ensure_initialized(self):
        """Guard method to ensure service is ready."""
        if not self._initialized or not self._bitget:
            raise Exception("LiveTradingService not initialized. Call initialize() first.")
    
    async def get_balance(self) -> Dict[str, Dict[str, float]]:
        """Get account balance from Bitget."""
        self._ensure_initialized()
        return await self._bitget.fetch_balance()
    
    async def place_order(
        self,
        symbol: str,
        side: str,  # 'BUY' or 'SELL'
        amount_usdt: float,
        leverage: int = 1,
        order_type: str = "MARKET",
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        strategy_id: Optional[UUID] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Place an order on Bitget.
        
        This method mirrors PaperTradingService.place_order() signature
        for drop-in replacement in TradingAgentInstance.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            side: "BUY" or "SELL"
            amount_usdt: Margin amount in USDT
            leverage: Leverage multiplier (default 1 for spot)
            order_type: "MARKET" or "LIMIT"
            price: Required for limit orders
            stop_loss: Optional stop loss price
            take_profit: Optional take profit price
            strategy_id: Agent ID for tracking
            
        Returns:
            Order result dict with 'id', 'status', 'filled', etc.
        """
        self._ensure_initialized()
        
        # Convert to Decimal for precision
        margin = Decimal(str(amount_usdt))
        
        # Get current price for size calculation
        ticker = await self._bitget.fetch_ticker(symbol)
        current_price = Decimal(str(ticker.get('last', 0)))
        
        if current_price <= 0:
            raise Exception(f"Could not fetch price for {symbol}")
        
        # Calculate order size (in base asset)
        # Position Size = Margin * Leverage / Price
        position_value = margin * leverage
        order_size = position_value / current_price
        
        logger.info(f"[LIVE] Placing {side} {order_type} order for {symbol}")
        logger.info(f"[LIVE] Margin: {margin} USDT, Leverage: {leverage}x, Size: {order_size}")
        
        # Place the order
        try:
            result = await self._bitget.place_order(
                symbol=symbol,
                side=side.lower(),
                order_type=order_type.lower(),
                amount=order_size,
                price=Decimal(str(price)) if price else None,
                leverage=leverage,
                stop_loss=Decimal(str(stop_loss)) if stop_loss else None,
                take_profit=Decimal(str(take_profit)) if take_profit else None
            )
            
            logger.info(f"[LIVE] Order placed successfully: {result.get('id', 'unknown')}")
            
            # Add extra metadata for tracking
            result['margin_usdt'] = float(margin)
            result['leverage'] = leverage
            result['strategy_id'] = str(strategy_id) if strategy_id else None
            
            return result
            
        except Exception as e:
            logger.error(f"[LIVE] Order placement failed: {e}")
            raise
    
    async def fetch_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """Fetch order status from Bitget."""
        self._ensure_initialized()
        return await self._bitget.fetch_order(order_id, symbol)
    
    async def cancel_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """Cancel an order on Bitget."""
        self._ensure_initialized()
        return await self._bitget.cancel_order(order_id, symbol)
    
    async def set_leverage(self, symbol: str, leverage: int, margin_mode: str = 'isolated') -> Dict:
        """
        Set leverage and margin mode for futures trading.
        
        NOTE: This should be called BEFORE placing futures orders,
        as Bitget requires the leverage to be set at account level.
        """
        self._ensure_initialized()
        return await self._bitget.set_leverage(symbol, leverage, margin_mode)
    
    async def get_ticker(self, symbol: str) -> Dict[str, Any]:
        """Get current ticker for a symbol."""
        self._ensure_initialized()
        return await self._bitget.fetch_ticker(symbol)
