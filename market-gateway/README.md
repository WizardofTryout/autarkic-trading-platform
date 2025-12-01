# Market Gateway Service

**Purpose:**
Handles high-throughput WebSocket connections to exchanges (Binance, Bitget, etc.) and normalizes data into the Redis message bus.

**Technology:**
- Rust or Go (recommended for low latency)
- Python (MVP fallback)

**Responsibilities:**
1.  Maintain persistent WebSocket connections.
2.  Normalize incoming tick data to a standard format.
3.  Publish updates to Redis Pub/Sub channels (e.g., `market.btc_usdt.ticker`).
4.  Push raw data to TimescaleDB for historical storage (optional, or handled by a separate consumer).
