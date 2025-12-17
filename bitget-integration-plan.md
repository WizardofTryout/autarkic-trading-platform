# Bitget Integration Plan & API Reference

*Verified via Firecrawl Drill-down on 2025-12-16*

## 1. Authentication (V2)
All private REST requests and the WebSocket login frame require the following headers.
**Signature**: `Base64(HMAC-SHA256(secretKey, timestamp + method.upper() + requestPath + "?" + queryString + body))`

> [!WARNING]
> **History Limitation**: Bitget API only provides access to the last **90 days** of Order/Fill history.
> Use `idLessThan` for pagination beyond page 1.
> For >90 days, users must initiate manual CSV export from the website.

| Header | Description |
| :--- | :--- |
| `ACCESS-KEY` | API Key |
| `ACCESS-PASSPHRASE` | API Passphrase |
| `ACCESS-TIMESTAMP` | Unix timestamp (ms) |
| `ACCESS-SIGN` | Generated Signature |
| `Content-Type` | `application/json` |

---

## 2. WebSocket API
- **Public**: `wss://ws.bitget.com/v2/ws/public`
- **Private**: `wss://ws.bitget.com/v2/ws/private`
- **Heartbeat**: 30s interval.

### Login (Private Only)
```json
{
  "op": "login",
  "args": [{
    "apiKey": "...",
    "passphrase": "...",
    "timestamp": "...",
    "sign": "..." // HmacSHA256(timestamp + "GET" + "/user/verify")
  }]
}
```

---

## 3. Spot Trading (V2)
**Base URL**: `https://api.bitget.com`

### Place Order
- **Endpoint**: `POST /api/v2/spot/trade/place-order`
- **Rate Limit**: 10 req/s/UID
- **JSON Body**:
```json
{
  "symbol": "BTCUSDT",
  "side": "buy" | "sell",
  "orderType": "limit" | "market",
  "force": "gtc" | "post_only" | "fok" | "ioc",
  "price": "23222.5",
  "size": "1",
  "clientOid": "unique-uuid"
}
```

---

## 4. Futures Trading (V2 Mix)
*Crucial*: Bitget distinguishes between "USDT-M" (`usdt-futures`) and "COIN-M" (`coin-futures`).

### Place Order
- **Endpoint**: `POST /api/v2/mix/order/place-order`
- **Rate Limit**: 10 req/s/UID
- **JSON Body**:
```json
{
  "symbol": "BTCUSDT",
  "productType": "usdt-futures",
  "marginMode": "isolated" | "crossed",
  "side": "buy" | "sell",
  "orderType": "limit" | "market",
  "tradeSide": "open" | "close", // REQUIRED for Futures
  "price": "...",
  "size": "...",
  "clientOid": "unique-uuid",
  "presetTakeProfitPrice": "...", // Optional
  "presetStopLossPrice": "..."    // Optional
}
```
> [!IMPORTANT]
> **Hedge Mode**:
> - Open Long: `side=buy`, `tradeSide=open`
> - Close Long: `side=sell`, `tradeSide=close`
> - Open Short: `side=sell`, `tradeSide=open`
> - Close Short: `side=buy`, `tradeSide=close`

### Market Data (History)
- **Endpoint**: `GET /api/v2/mix/market/candles`
- **Params**: `symbol`, `productType` (usdt-futures), `granularity` (1m, 5m...), `startTime`, `endTime`, `limit`.

---

## 5. History & Reconciliation Use Cases

### Order History (Last 90 Days)
- **Spot**: `GET /api/v2/spot/trade/history-orders`
- **Futures**: `GET /api/v2/mix/order/history-orders` OR `GET /api/v2/mix/order/orders-history` (Check V2 docs carefully, search result pointed to `orders-history`).
- **Limit**: Record start time cannot be > 90 days ago.

### Transaction Details (Fills)
- **Spot**: `GET /api/v2/spot/trade/fills`
- **Futures**: `GET /api/v2/mix/order/fills`
- **Use for**: PnL calculation, fee deduction analysis.

### Account Ledger (Bills)
- **Spot**: `GET /api/v2/spot/account/bills`
- **Futures**: `GET /api/v2/mix/account/bill`
- **Use for**: Funding fees, transfers, deposits/withdrawals.

---

## Implementation Rules
1. **Always set `productType='usdt-futures'`** for perp trading unless specified otherwise.
2. **Handle `tradeSide` logic** carefully mapping our `Entry`/`Exit` concepts to `open`/`close`.
3. **Use `clientOid`** to track orders without waiting for WS latency.
