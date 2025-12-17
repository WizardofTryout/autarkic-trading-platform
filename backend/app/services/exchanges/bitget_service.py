"""
Bitget Exchange Service Implementation.

Implements the ExchangeService interface for Bitget V2 API.
Handles authentication, rate limiting, and all trading operations.

SECURITY NOTES:
- API keys are NEVER logged
- Signature is computed per-request, not cached
- Rate limiter prevents API bans

RATE LIMITS (V2 API):
- Public endpoints: 20 req/s (IP)
- Private endpoints: 10 req/s (UID)
- Place Order: 10 req/s (UID)
"""

import asyncio
import hashlib
import hmac
import time
import logging
from decimal import Decimal
from typing import Dict, List, Optional, Any
from datetime import datetime

import httpx

from .base import ExchangeService

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Simple token bucket rate limiter.
    Ensures we stay within API limits (max 8/s with buffer).
    """
    
    def __init__(self, max_requests: int = 8, per_seconds: float = 1.0):
        self.max_requests = max_requests
        self.per_seconds = per_seconds
        self._tokens = max_requests
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()
    
    async def acquire(self):
        """Wait until a request slot is available."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            
            # Refill tokens based on elapsed time
            self._tokens = min(
                self.max_requests, 
                self._tokens + (elapsed * self.max_requests / self.per_seconds)
            )
            self._last_refill = now
            
            if self._tokens < 1:
                # Wait for next token
                wait_time = (1 - self._tokens) * self.per_seconds / self.max_requests
                await asyncio.sleep(wait_time)
                self._tokens = 1
            
            self._tokens -= 1


class BitgetService(ExchangeService):
    """
    Bitget V2 API Implementation.
    
    Usage:
        service = BitgetService(api_key, secret, passphrase)
        balance = await service.fetch_balance()
    """
    
    exchange_id = "bitget"
    
    BASE_URL = "https://api.bitget.com"
    
    def __init__(
        self, 
        api_key: str, 
        secret: str, 
        passphrase: str,
        testnet: bool = False
    ):
        self.api_key = api_key
        self.secret = secret
        self.passphrase = passphrase
        
        if testnet:
            self.BASE_URL = "https://api.bitget.com"  # Bitget uses same URL, different endpoints
        
        self._rate_limiter = RateLimiter(max_requests=8, per_seconds=1.0)
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy initialization of HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
    
    def _sign(self, timestamp: str, method: str, path: str, body: str = "") -> str:
        """
        Generate HMAC-SHA256 signature for Bitget V2 API.
        
        Signature = Base64(HMAC-SHA256(timestamp + method + path + body, secret))
        """
        message = f"{timestamp}{method.upper()}{path}{body}"
        signature = hmac.new(
            self.secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).digest()
        import base64
        return base64.b64encode(signature).decode('utf-8')
    
    def _headers(self, method: str, path: str, body: str = "") -> Dict[str, str]:
        """Generate authenticated headers."""
        timestamp = str(int(time.time() * 1000))
        signature = self._sign(timestamp, method, path, body)
        
        return {
            "ACCESS-KEY": self.api_key,
            "ACCESS-SIGN": signature,
            "ACCESS-TIMESTAMP": timestamp,
            "ACCESS-PASSPHRASE": self.passphrase,
            "Content-Type": "application/json",
            "locale": "en-US"
        }
    
    async def _request(
        self, 
        method: str, 
        path: str, 
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        signed: bool = True
    ) -> Dict:
        """
        Make an authenticated API request with rate limiting.
        """
        await self._rate_limiter.acquire()
        
        client = await self._get_client()
        url = f"{self.BASE_URL}{path}"
        
        body = ""
        if data:
            import json
            body = json.dumps(data)
        
        if params:
            # Add query params to path for signature
            query = "&".join(f"{k}={v}" for k, v in params.items())
            path_with_query = f"{path}?{query}"
        else:
            path_with_query = path
        
        headers = self._headers(method, path_with_query, body) if signed else {}
        
        try:
            if method.upper() == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method.upper() == "POST":
                response = await client.post(url, content=body, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            result = response.json()
            
            if result.get("code") != "00000":
                logger.error(f"Bitget API Error: {result}")
                raise Exception(f"Bitget API Error: {result.get('msg', 'Unknown error')}")
            
            return result.get("data", {})
        
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP Error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Request failed: {e}")
            raise
    
    # ========================
    # ExchangeService Interface
    # ========================
    
    async def validate_keys(self) -> bool:
        """Validate API keys by fetching account info."""
        try:
            await self._request("GET", "/api/v2/spot/account/info")
            return True
        except Exception as e:
            logger.warning(f"Key validation failed: {e}")
            return False
    
    async def fetch_balance(self) -> Dict[str, Dict[str, float]]:
        """Fetch spot account balance."""
        data = await self._request("GET", "/api/v2/spot/account/assets")
        
        balances = {}
        for asset in data:
            coin = asset.get("coin", "")
            balances[coin] = {
                "free": float(asset.get("available", 0)),
                "used": float(asset.get("frozen", 0)),
                "total": float(asset.get("available", 0)) + float(asset.get("frozen", 0))
            }
        return balances
    
    async def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        """Fetch current ticker for a symbol."""
        # Convert symbol format (BTC/USDT -> BTCUSDT)
        formatted_symbol = symbol.replace("/", "")
        
        data = await self._request(
            "GET", 
            "/api/v2/spot/market/tickers",
            params={"symbol": formatted_symbol},
            signed=False
        )
        
        if data and len(data) > 0:
            ticker = data[0]
            return {
                "symbol": symbol,
                "last": float(ticker.get("lastPr", 0)),
                "bid": float(ticker.get("bidPr", 0)),
                "ask": float(ticker.get("askPr", 0)),
                "volume": float(ticker.get("baseVolume", 0)),
                "timestamp": int(ticker.get("ts", 0))
            }
        return {}
    
    async def fetch_ohlcv(
        self, symbol: str, timeframe: str, limit: int = 100, since: Optional[int] = None
    ) -> List[List]:
        """Fetch OHLCV candlestick data."""
        formatted_symbol = symbol.replace("/", "")
        
        # Map timeframe to Bitget granularity
        tf_map = {
            "1s": "1s", "1m": "1min", "5m": "5min", "15m": "15min",
            "30m": "30min", "1h": "1h", "4h": "4h", "1d": "1day"
        }
        granularity = tf_map.get(timeframe, "1min")
        
        params = {
            "symbol": formatted_symbol,
            "granularity": granularity,
            "limit": str(limit)
        }
        if since:
            params["startTime"] = str(since)
        
        data = await self._request(
            "GET",
            "/api/v2/spot/market/candles",
            params=params,
            signed=False
        )
        
        # Convert to standard format: [timestamp, open, high, low, close, volume]
        ohlcv = []
        for candle in data:
            ohlcv.append([
                int(candle[0]),      # timestamp
                float(candle[1]),    # open
                float(candle[2]),    # high
                float(candle[3]),    # low
                float(candle[4]),    # close
                float(candle[5])     # volume
            ])
        return ohlcv
    
    async def place_order(
        self, 
        symbol: str, 
        side: str,
        order_type: str,
        amount: Decimal,
        price: Optional[Decimal] = None,
        leverage: Optional[int] = None,
        stop_loss: Optional[Decimal] = None,
        take_profit: Optional[Decimal] = None,
        params: Optional[Dict] = None
    ) -> Dict:
        """Place an order on Bitget Spot."""
        formatted_symbol = symbol.replace("/", "")
        
        order_data = {
            "symbol": formatted_symbol,
            "side": side.lower(),  # buy/sell
            "orderType": order_type.lower(),  # market/limit
            "size": str(amount),
            "force": "gtc"  # Good Till Cancel
        }
        
        if order_type.lower() == "limit" and price:
            order_data["price"] = str(price)
        
        result = await self._request("POST", "/api/v2/spot/trade/place-order", data=order_data)
        
        return {
            "id": result.get("orderId", ""),
            "clientOrderId": result.get("clientOid", ""),
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "amount": float(amount),
            "price": float(price) if price else None,
            "status": "open"
        }
    
    async def fetch_order(self, order_id: str, symbol: str) -> Dict:
        """Fetch order status."""
        formatted_symbol = symbol.replace("/", "")
        
        data = await self._request(
            "GET",
            "/api/v2/spot/trade/orderInfo",
            params={"symbol": formatted_symbol, "orderId": order_id}
        )
        
        return {
            "id": data.get("orderId", ""),
            "symbol": symbol,
            "status": data.get("state", "unknown"),
            "filled": float(data.get("baseVolume", 0)),
            "price": float(data.get("priceAvg", 0))
        }
    
    async def cancel_order(self, order_id: str, symbol: str) -> Dict:
        """Cancel an open order."""
        formatted_symbol = symbol.replace("/", "")
        
        result = await self._request(
            "POST",
            "/api/v2/spot/trade/cancel-order",
            data={"symbol": formatted_symbol, "orderId": order_id}
        )
        
        return {"id": order_id, "status": "canceled"}
    
    async def set_leverage(
        self, symbol: str, leverage: int, margin_mode: str = 'isolated'
    ) -> Dict:
        """
        Set leverage for Futures trading.
        NOTE: This is for Futures only. Spot trading ignores this.
        """
        formatted_symbol = symbol.replace("/", "")
        
        # This would be the Futures endpoint
        # For spot, this is a no-op
        logger.info(f"set_leverage called for Spot - no action needed (Spot has no leverage)")
        return {"symbol": symbol, "leverage": 1, "marginMode": "spot"}
    
    async def fetch_positions(self, symbol: Optional[str] = None) -> List[Dict]:
        """
        Fetch open positions (Futures only).
        For Spot, this returns an empty list.
        """
        # Spot doesn't have positions in the Futures sense
        return []
    
    # ========================
    # History Methods (Phase 5)
    # ========================
    
    async def fetch_order_history(
        self, 
        symbol: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Fetch order history from Bitget.
        
        API: /api/v2/spot/trade/history-orders
        
        Returns list of orders with status, fills, fees, etc.
        """
        params = {"limit": str(limit)}
        
        if symbol:
            params["symbol"] = symbol.replace("/", "")
        if start_time:
            params["startTime"] = str(start_time)
        if end_time:
            params["endTime"] = str(end_time)
        
        data = await self._request(
            "GET",
            "/api/v2/spot/trade/history-orders",
            params=params
        )
        
        orders = []
        for order in data if isinstance(data, list) else []:
            orders.append({
                "exchange_order_id": order.get("orderId", ""),
                "client_order_id": order.get("clientOid"),
                "symbol": order.get("symbol", ""),
                "side": order.get("side", ""),
                "order_type": order.get("orderType", ""),
                "price": order.get("price"),
                "avg_fill_price": order.get("priceAvg"),
                "size": order.get("size", "0"),
                "filled_size": order.get("baseVolume", "0"),
                "total_fee": order.get("feeDetail", {}).get("totalFee") if order.get("feeDetail") else None,
                "fee_currency": order.get("feeDetail", {}).get("feeCoin") if order.get("feeDetail") else None,
                "status": order.get("state", "unknown"),
                "created_at": order.get("cTime"),
                "updated_at": order.get("uTime")
            })
        
        return orders
    
    async def fetch_fills(
        self,
        symbol: Optional[str] = None,
        order_id: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Fetch trade fills (executions) from Bitget.
        
        API: /api/v2/spot/trade/fills
        
        Returns individual fills with price, size, fee, role (maker/taker).
        """
        params = {"limit": str(limit)}
        
        if symbol:
            params["symbol"] = symbol.replace("/", "")
        if order_id:
            params["orderId"] = order_id
        if start_time:
            params["startTime"] = str(start_time)
        if end_time:
            params["endTime"] = str(end_time)
        
        data = await self._request(
            "GET",
            "/api/v2/spot/trade/fills",
            params=params
        )
        
        fills = []
        for fill in data if isinstance(data, list) else []:
            fills.append({
                "exchange_trade_id": fill.get("tradeId", ""),
                "exchange_order_id": fill.get("orderId", ""),
                "symbol": fill.get("symbol", ""),
                "side": fill.get("side", ""),
                "price": fill.get("priceAvg", "0"),
                "size": fill.get("size", "0"),
                "quote_size": fill.get("quoteVolume"),
                "fee": fill.get("feeDetail", {}).get("totalFee") if fill.get("feeDetail") else "0",
                "fee_currency": fill.get("feeDetail", {}).get("feeCoin") if fill.get("feeDetail") else None,
                "role": fill.get("tradeScope", "").lower(),  # maker/taker
                "executed_at": fill.get("cTime")
            })
        
        return fills
    
    async def fetch_bills(
        self,
        coin: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Fetch account bills (ledger) from Bitget.
        
        API: /api/v2/spot/account/bills
        
        Returns transfers, trades, fees, deposits, withdrawals.
        Used for tax reporting and balance reconciliation.
        """
        params = {"limit": str(limit)}
        
        if coin:
            params["coin"] = coin
        if start_time:
            params["startTime"] = str(start_time)
        if end_time:
            params["endTime"] = str(end_time)
        
        data = await self._request(
            "GET",
            "/api/v2/spot/account/bills",
            params=params
        )
        
        bills = []
        for bill in data if isinstance(data, list) else []:
            bills.append({
                "record_id": bill.get("billId", ""),
                "record_type": bill.get("businessType", "unknown"),
                "business_type": bill.get("businessType"),
                "amount": bill.get("size", "0"),
                "currency": bill.get("coin", ""),
                "balance_after": bill.get("balance"),
                "symbol": bill.get("symbol"),
                "related_order_id": bill.get("orderId"),
                "recorded_at": bill.get("cTime")
            })
        
        return bills
