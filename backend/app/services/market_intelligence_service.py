"""
Market Intelligence Service - Provides AI-ready data for Research Agent.

Fetches sentiment and flow data from Bitget Trading Insights API.
Data is used to augment trend analysis with "smart money" indicators.

ENDPOINTS USED:
- Whale Net Flow: /api/v2/spot/market/fund-flow
- Taker Buy/Sell Volume: /api/v2/mix/market/taker-buy-sell
- Long/Short Ratio: /api/v2/mix/market/long-short

RATE LIMITS:
- All endpoints: 1 req/s (IP) - Very conservative
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)


class MarketIntelligenceService:
    """
    Fetches market sentiment data from Bitget Trading Insights.
    
    This service is READ-ONLY and does not require API authentication.
    All endpoints are public.
    
    Usage:
        service = MarketIntelligenceService()
        whale_data = await service.get_whale_flow("BTC/USDT")
    """
    
    BASE_URL = "https://api.bitget.com"
    
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._last_request = 0.0
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy initialization of HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
    
    async def _request(self, path: str, params: Dict) -> Dict:
        """
        Make a rate-limited public API request.
        Rate limit: 1 req/s (to be safe with these endpoints)
        """
        import time
        
        # Ensure at least 1 second between requests
        now = time.monotonic()
        elapsed = now - self._last_request
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)
        
        self._last_request = time.monotonic()
        
        client = await self._get_client()
        url = f"{self.BASE_URL}{path}"
        
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            result = response.json()
            
            if result.get("code") != "00000":
                logger.warning(f"Bitget API Warning: {result.get('msg', 'Unknown')}")
                return {}
            
            return result.get("data", {})
        
        except Exception as e:
            logger.error(f"Market Intelligence request failed: {e}")
            return {}
    
    async def get_whale_flow(
        self, 
        symbol: str, 
        period: str = "1d"
    ) -> Dict[str, Any]:
        """
        Get Spot Whale Net Flow Data.
        
        Shows buying/selling activity segmented by trader size:
        - Whale: Large traders
        - Dolphin: Medium traders
        - Fish: Small traders
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            period: Time period (15m, 30m, 1h, 2h, 4h, 1d)
        
        Returns:
            {
                "whaleBuyVolume": "50.901",
                "whaleSellVolume": "48.635",
                "net_flow": 2.266,  # Calculated: buy - sell
                "sentiment": "bullish",  # Interpreted
                ...
            }
        """
        formatted_symbol = symbol.replace("/", "")
        
        data = await self._request(
            "/api/v2/spot/market/fund-flow",
            {"symbol": formatted_symbol, "period": period}
        )
        
        if not data:
            return {"error": "No data available"}
        
        # Calculate net flow and interpret sentiment
        whale_buy = float(data.get("whaleBuyVolume", 0))
        whale_sell = float(data.get("whaleSellVolume", 0))
        net_flow = whale_buy - whale_sell
        
        # Determine sentiment based on net flow
        if net_flow > 0:
            sentiment = "bullish"
        elif net_flow < 0:
            sentiment = "bearish"
        else:
            sentiment = "neutral"
        
        return {
            **data,
            "net_flow": net_flow,
            "sentiment": sentiment,
            "period": period,
            "symbol": symbol
        }
    
    async def get_taker_volume(
        self, 
        symbol: str, 
        period: str = "1h"
    ) -> List[Dict[str, Any]]:
        """
        Get Futures Active Buy/Sell Volume (Taker Volume).
        
        Shows aggressive buying vs selling pressure.
        Higher buy volume = buyers are urgent = bullish pressure.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            period: Time period (5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d)
        
        Returns:
            List of {buyVolume, sellVolume, ts, ratio}
        """
        formatted_symbol = symbol.replace("/", "")
        
        data = await self._request(
            "/api/v2/mix/market/taker-buy-sell",
            {"symbol": formatted_symbol, "period": period}
        )
        
        if not data or not isinstance(data, list):
            return []
        
        # Enhance with buy/sell ratio
        result = []
        for item in data:
            buy = float(item.get("buyVolume", 0))
            sell = float(item.get("sellVolume", 0))
            ratio = buy / sell if sell > 0 else float('inf')
            
            result.append({
                "buyVolume": buy,
                "sellVolume": sell,
                "timestamp": int(item.get("ts", 0)),
                "ratio": round(ratio, 2),
                "pressure": "buy" if ratio > 1 else "sell"
            })
        
        return result
    
    async def get_long_short_ratio(
        self, 
        symbol: str, 
        period: str = "1h"
    ) -> List[Dict[str, Any]]:
        """
        Get Futures Long/Short Ratio.
        
        Shows the proportion of long vs short positions.
        High long ratio (>1) = Market is bullish positioned.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            period: Time period (5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1Dutc)
        
        Returns:
            List of {longRatio, shortRatio, longShortRatio, ts}
        """
        formatted_symbol = symbol.replace("/", "")
        
        data = await self._request(
            "/api/v2/mix/market/long-short",
            {"symbol": formatted_symbol, "period": period}
        )
        
        if not data or not isinstance(data, list):
            return []
        
        result = []
        for item in data:
            ls_ratio = float(item.get("longShortRatio", 1))
            
            # Interpret the ratio
            if ls_ratio > 1.2:
                position_sentiment = "heavily_long"
            elif ls_ratio > 1:
                position_sentiment = "slightly_long"
            elif ls_ratio < 0.8:
                position_sentiment = "heavily_short"
            elif ls_ratio < 1:
                position_sentiment = "slightly_short"
            else:
                position_sentiment = "balanced"
            
            result.append({
                "longRatio": float(item.get("longRatio", 0)),
                "shortRatio": float(item.get("shortRatio", 0)),
                "longShortRatio": ls_ratio,
                "timestamp": int(item.get("ts", 0)),
                "positionSentiment": position_sentiment
            })
        
        return result
    
    async def get_market_summary(self, symbol: str) -> Dict[str, Any]:
        """
        Get a comprehensive market intelligence summary.
        
        Combines whale flow, taker volume, and L/S ratio into a single
        actionable summary for the Research Agent.
        
        Returns:
            {
                "symbol": "BTC/USDT",
                "whale_sentiment": "bullish",
                "taker_pressure": "buy",
                "position_sentiment": "heavily_long",
                "overall_signal": "bullish" | "bearish" | "neutral",
                "confidence": 0.0 - 1.0,
                "raw_data": {...}
            }
        """
        # Fetch all data concurrently
        whale_task = self.get_whale_flow(symbol, "4h")
        taker_task = self.get_taker_volume(symbol, "1h")
        ls_task = self.get_long_short_ratio(symbol, "1h")
        
        whale, taker, ls = await asyncio.gather(whale_task, taker_task, ls_task)
        
        # Score calculation
        score = 0  # -3 to +3
        
        # Whale sentiment
        whale_sentiment = whale.get("sentiment", "neutral")
        if whale_sentiment == "bullish":
            score += 1
        elif whale_sentiment == "bearish":
            score -= 1
        
        # Taker pressure (latest)
        taker_pressure = "neutral"
        if taker and len(taker) > 0:
            taker_pressure = taker[-1].get("pressure", "neutral")
            if taker_pressure == "buy":
                score += 1
            elif taker_pressure == "sell":
                score -= 1
        
        # Position sentiment (latest)
        position_sentiment = "balanced"
        if ls and len(ls) > 0:
            position_sentiment = ls[-1].get("positionSentiment", "balanced")
            if "long" in position_sentiment:
                score += 1
            elif "short" in position_sentiment:
                score -= 1
        
        # Determine overall signal
        if score >= 2:
            overall = "bullish"
            confidence = min(1.0, score / 3)
        elif score <= -2:
            overall = "bearish"
            confidence = min(1.0, abs(score) / 3)
        else:
            overall = "neutral"
            confidence = 0.3
        
        return {
            "symbol": symbol,
            "whale_sentiment": whale_sentiment,
            "taker_pressure": taker_pressure,
            "position_sentiment": position_sentiment,
            "overall_signal": overall,
            "confidence": round(confidence, 2),
            "score": score,
            "raw_data": {
                "whale": whale,
                "taker": taker[-5:] if taker else [],  # Last 5 entries
                "longShort": ls[-5:] if ls else []
            }
        }
