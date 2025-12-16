"""
Abstract Base Class for Exchange Services.

This interface ensures a clean separation between Paper Trading and Live Trading.
The rest of the application interacts with this interface, NOT with specific
exchange implementations directly.

ARCHITECT NOTES:
- All methods are async for non-blocking I/O
- Implementations: PaperTradingService (existing), BitgetService (new)
- Rate limiting is the responsibility of the concrete implementation
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from decimal import Decimal


class ExchangeService(ABC):
    """
    Abstract Interface for all Trading Services (Paper & Live).
    
    CRITICAL: This interface ensures that the REST of the application 
    does not know (and does not care) whether it is talking to 
    the PaperTradingService or the Real BitgetService.
    
    This guarantees zero interference with existing Paper Trading logic.
    """
    
    # Exchange identifier (e.g., 'paper', 'bitget', 'binance')
    exchange_id: str = "abstract"

    @abstractmethod
    async def validate_keys(self) -> bool:
        """
        Verifies if the stored API keys are valid.
        For Paper: Always returns True.
        For Live: Performs a lightweight API ping (e.g., fetch account info).
        """
        pass

    @abstractmethod
    async def fetch_balance(self) -> Dict[str, Dict[str, float]]:
        """
        Returns standardized balance dict.
        Format: {'USDT': {'free': 1000.0, 'used': 0.0, 'total': 1000.0}, ...}
        """
        pass

    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        """
        Fetch current ticker (last price, bid, ask) for a symbol.
        Returns: {'symbol': 'BTC/USDT', 'last': 97000.0, 'bid': 96990.0, 'ask': 97010.0}
        """
        pass

    @abstractmethod
    async def fetch_ohlcv(
        self, symbol: str, timeframe: str, limit: int = 100, since: Optional[int] = None
    ) -> List[List]:
        """
        Standardized OHLCV fetcher.
        Returns: [[timestamp, open, high, low, close, volume], ...]
        """
        pass

    @abstractmethod
    async def place_order(
        self, 
        symbol: str, 
        side: str,  # 'buy' or 'sell'
        order_type: str,  # 'market' or 'limit'
        amount: Decimal,  # Size in base asset (e.g., 0.1 BTC)
        price: Optional[Decimal] = None,  # Required for limit orders
        leverage: Optional[int] = None,
        stop_loss: Optional[Decimal] = None,
        take_profit: Optional[Decimal] = None,
        params: Optional[Dict] = None
    ) -> Dict:
        """
        Places an order. 
        Returns standardized order result dict: 
        {'id': '...', 'status': 'open'|'closed'|'canceled', 'filled': 0.0, ...}
        """
        pass

    @abstractmethod
    async def fetch_order(self, order_id: str, symbol: str) -> Dict:
        """
        Fetches status of a specific order.
        """
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str) -> Dict:
        """
        Cancels an order.
        """
        pass

    @abstractmethod
    async def set_leverage(
        self, symbol: str, leverage: int, margin_mode: str = 'isolated'
    ) -> Dict:
        """
        Sets leverage and margin mode (cross/isolated) for Futures trading.
        For Spot: This is a no-op.
        """
        pass

    @abstractmethod
    async def fetch_positions(self, symbol: Optional[str] = None) -> List[Dict]:
        """
        Fetch open positions (Futures only).
        Returns: [{'symbol': 'BTC/USDT', 'side': 'long', 'size': 0.1, ...}, ...]
        """
        pass
