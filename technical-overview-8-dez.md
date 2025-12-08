# Technical Overview: Autarkic Trading Platform
**Status:** December 2025  
**Version:** 0.2.0  
**Last Updated:** 2025-12-08

---

## 1. System Architecture

### 1.1 Docker Infrastructure

The platform runs on a **microservices architecture** with 6 containerized services orchestrated via Docker Compose:

| Service | Container | Port | Networks | Purpose |
|---------|-----------|------|----------|---------|
| **Frontend** | `frontend` | 5173 | `public_net` | React 19 SPA with Vite |
| **Backend** | `backend` | 8000 | `public_net`, `app_net`, `data_net` | FastAPI REST API |
| **Strategy Engine** | `strategy-engine` | 8001 | `app_net`, `data_net` | Pine Script transpiler & execution |
| **AI Sentinel** | `ai-sentinel` | - | `app_net` (internal only) | AI analysis (isolated, no internet) |
| **Database** | `ledger-db` | - | `data_net` (internal only) | TimescaleDB (PostgreSQL 15) |
| **Cache** | `redis` | - | `data_net`, `app_net` | Redis for session & real-time data |

#### Network Isolation Strategy
- **`public_net`**: Exposed to host (frontend, backend API)
- **`app_net`**: Internal communication between services (no internet)
- **`data_net`**: Database access layer (fully isolated)

This architecture ensures:
- AI Sentinel cannot access external networks (security)
- Database is only accessible to backend/strategy-engine
- Frontend communicates exclusively via backend API

---

## 2. Technology Stack

### 2.1 Frontend (`frontend/`)
- **Framework:** React 19.2.0
- **Build Tool:** Vite 7.2.4
- **Styling:** TailwindCSS v4.1.17 (latest)
- **State Management:** Zustand 5.0.9
- **Charting:** 
  - **KlineCharts 9.8.12** (primary chart library)
  - D3.js 7.9.0 (advanced technical indicators - legacy)
  - Lightweight Charts 5.0.9 (TradingView-style charts - legacy)
- **Code Editor:** CodeMirror (Pine Script editor)
- **Routing:** React Router DOM 7.9.6
- **Markdown:** react-markdown 10.1.0 (for AI analysis reports)

### 2.2 Backend (`backend/`)
- **Framework:** FastAPI 0.109.0
- **Runtime:** Python 3.11
- **ORM:** SQLAlchemy 2.0.25 (async)
- **Database Driver:** asyncpg 0.29.0
- **Migrations:** Alembic 1.13.1
- **Exchange Integration:** CCXT 4.2.19
- **WebSockets:** websockets 12.0
- **Data Processing:** pandas 2.2.0, numpy 1.26.0
- **AI Integration:** google-generativeai 0.4.0

### 2.3 Strategy Engine (`strategy-engine/`)
- **Purpose:** Pine Script → Python transpilation
- **Components:**
  - `parser.py`: Parses Pine Script DSL syntax
  - `generator.py`: Generates executable Python code
- **Execution:** Runs compiled strategies in isolated environment

### 2.4 Database
- **Type:** TimescaleDB (PostgreSQL 15 with time-series extensions)
- **Storage:** Persistent volumes (`postgres_data`, `redis_data`)
- **Secrets Management:** Docker secrets for password (`/run/secrets/db_password`)

---

## 3. Security Architecture

### 3.1 Authentication & Authorization
- **Password Hashing:** Argon2 (via `argon2-cffi`)
- **Token System:** JWT (HS256 algorithm)
  - Access token expiry: 30 minutes
  - Secret key: Configurable via `SECRET_KEY` environment variable
- **Session Management:** Redis-backed sessions

### 3.2 API Key Encryption
API keys (Binance, Gemini, OpenAI, etc.) are stored encrypted in the database:

**Database Schema (`user_api_keys` table):**
```sql
- encrypted_value: String (AES-256 encrypted)
- provider: String (gemini, openai, binance, etc.)
- model: String (optional, e.g., "gemini-1.5-pro")
- is_valid: Boolean (validation status)
- last_validated: DateTime
```

**Encryption Method:**
- Uses Python `cryptography` library (Fernet symmetric encryption)
- Keys stored in `VaultKey` table with:
  - `ciphertext`: Encrypted API key
  - `nonce`: Cryptographic nonce for AES
  - `key_metadata`: JSONB for rotation tracking

### 3.3 Network Security
- **AI Sentinel Isolation:** No internet access (internal network only)
- **Database Isolation:** Only accessible via `data_net` (no external exposure)
- **HTTPS:** Recommended for production (currently HTTP in dev)

---

## 4. Database Schema

### 4.1 Core Tables

#### **Users** (`users`)
```sql
id: UUID (primary key)
username: String (unique, indexed)
email: String (unique, indexed)
hashed_password: String (Argon2)
is_active: Boolean
created_at: DateTime
last_login: DateTime
preferences: JSONB (user settings)
```

#### **VaultKeys** (`vault_keys`)
```sql
id: UUID
user_id: UUID (FK → users)
exchange: String (e.g., "binance")
ciphertext: LargeBinary (encrypted API key)
nonce: LargeBinary (encryption nonce)
key_metadata: JSONB
created_at: DateTime
last_rotated_at: DateTime
```

#### **UserSecret** (`user_api_keys`)
```sql
id: UUID
user_id: UUID (FK → users)
key_name: String (e.g., "My Gemini Key")
provider: String (gemini, openai, binance, etc.)
model: String (optional)
encrypted_value: String
is_valid: Boolean
last_validated: DateTime
```

### 4.2 Trading System Tables

#### **PaperAccount** (`paper_accounts`)
```sql
id: UUID
user_id: UUID (FK → users, unique)
balance: Numeric(20,8) (available USDT)
locked_balance: Numeric(20,8) (reserved for active strategies)
currency: String (default: "USDT")
created_at: DateTime
updated_at: DateTime
```

#### **PaperPosition** (`paper_positions`)
```sql
id: UUID
account_id: UUID (FK → paper_accounts)
strategy_id: UUID (optional, FK → active_strategies)
symbol: String (e.g., "BTC/USDT")
side: String (LONG/SHORT)
size: Numeric(20,8)
entry_price: Numeric(20,8)
leverage: Integer
liquidation_price: Numeric(20,8)
stop_loss: Numeric(20,8)
take_profit: Numeric(20,8)
is_trailing_stop: Boolean
trailing_percent: Numeric(5,4) (e.g., 0.05 = 5%)
margin: Numeric(20,8)
```

#### **PaperOrder** (`paper_orders`)
```sql
id: UUID
account_id: UUID (FK → paper_accounts)
strategy_id: UUID (optional)
symbol: String
side: String (BUY/SELL)
type: String (MARKET/LIMIT)
price: Numeric(20,8) (for LIMIT orders)
stop_loss: Numeric(20,8)
take_profit: Numeric(20,8)
is_trailing_stop: Boolean
trailing_percent: Numeric(5,4)
quantity: Numeric(20,8) (base asset, e.g., BTC)
filled_quantity: Numeric(20,8)
status: String (OPEN/FILLED/CANCELLED)
leverage: Integer
```

#### **PaperTrade** (`paper_trades`)
```sql
id: UUID
account_id: UUID (FK → paper_accounts)
order_id: UUID (FK → paper_orders)
symbol: String
side: String (BUY/SELL)
price: Numeric(20,8)
quantity: Numeric(20,8)
fee: Numeric(20,8)
fee_currency: String (default: "USDT")
realized_pnl: Numeric(20,8)
timestamp: DateTime
```

### 4.3 Strategy & Indicator Tables

#### **Strategy** (`strategies`)
```sql
id: UUID
user_id: UUID (FK → users)
name: String
source_code: String (Pine Script DSL)
compiled_artifact: LargeBinary (Python bytecode)
parameters: JSONB
status: String (draft/testing/active/disabled)
type: String (strategy/indicator)
is_favorite: Boolean
category: String (default: "Personal")
created_at: DateTime
```

#### **ActiveStrategy** (`active_strategies`)
```sql
id: UUID
user_id: UUID (FK → users)
strategy_id: UUID (FK → strategies)
symbol: String
timeframe: String (e.g., "15m")
amount: Numeric(20,8) (initial investment)
current_capital: Numeric(20,8) (current value)
risk_per_trade: Numeric(5,4) (default: 0.01 = 1%)
risk_reward_ratio: Numeric(5,2) (default: 2.0)
stop_loss_percent: Numeric(5,4) (default: 0.02 = 2%)
use_trailing_stop: Boolean
trailing_stop_percent: Numeric(5,4)
status: String (RUNNING/PAUSED/STOPPED)
```

### 4.4 Document Management

#### **UserDocument** (`user_documents`)
```sql
id: UUID
user_id: UUID (FK → users)
title: String
content: String (Markdown)
doc_type: String (default: "research_report")
tags: JSONB (e.g., ["BTC/USDT", "Bullish"])
folder: String (default: "General")
created_at: DateTime
updated_at: DateTime
```

### 4.5 Audit Trail

#### **LedgerEntry** (`ledger_entries`)
```sql
id: Integer (auto-increment)
prev_hash: String(64) (blockchain-style linking)
payload: JSONB (trade/order data)
timestamp: DateTime
signer_id: UUID (user who initiated)
hash: String(64) (SHA-256 of entry)
```

**Purpose:** Immutable audit log for all trading actions (compliance & debugging).

---

## 5. Implemented Features

### 5.1 Authentication & User Management
- ✅ User registration with email validation
- ✅ Secure login (Argon2 + JWT)
- ✅ Session persistence (Redis)
- ✅ User preferences (JSONB storage)

### 5.2 Charting & Technical Analysis
- ✅ **Real-time Charts (KlineCharts 9.8.12):**
  - Binance WebSocket integration (live price feeds)
  - Multiple timeframes (1s, 1m, 5m, 15m, 30m, 1h, 4h, 1d)
  - Professional candlestick rendering
  - Volume bars (fixed positioning)
- ✅ **Technical Indicators (KlineCharts built-in):**
  - MA (Moving Averages: MA5, MA10, MA20, MA60)
  - RSI (14-period)
  - Bollinger Bands (20-period, 2σ)
  - MACD (12/26/9)
  - Volume
- ✅ **Drawing Tools (NEW - 2025-12-08):**
  - **Lines Group:** Horizontal/Vertical (Straight, Ray, Segment)
  - **Trend Lines:** straightLine, rayLine, segment, priceLine
  - **Fibonacci:** fibonacciLine
  - **Channels:** priceChannelLine, parallelStraightLine
  - **Annotations:** simpleAnnotation, simpleTag
  - **Collapsible Left Sidebar** (TradingView-style)
  - **Keyboard Support:** Delete/Backspace removes selected overlay, ESC cancels
- ✅ **Trading Signals:**
  - Dynamic signal calculation (Buy/Sell/Neutral)
  - Signal strength (0-100%)
  - Multi-indicator consensus logic
- ✅ **UI Features:**
  - Indicator toggle (show/hide)
  - Last Update timestamp (data feed monitoring)
  - Responsive design
  - Chart settings customization (background color, text color)

### 5.3 Paper Trading System
- ✅ **Order Types:**
  - Market orders (instant execution at current price)
  - Limit orders (execute when price reaches target)
  - Marketable limit orders (execute immediately if price is favorable)
- ✅ **Risk Management:**
  - Leverage (1x - 100x)
  - Take Profit (TP) levels
  - Stop Loss (SL) levels
  - **Trailing Stop Loss:**
    - Configurable trailing percentage (0.1% - 10%)
    - Automatic SL adjustment as price moves favorably
    - Visual warning if TP distance < trailing distance
- ✅ **Position Management:**
  - Long/Short positions
  - Real-time P&L calculation
  - Liquidation price tracking
  - Margin requirements
  - Position close with PnL result modal
- ✅ **Order Management:**
  - Order cancellation with confirmation modal
  - Order editing (price, SL/TP adjustment)
  - Pre-filled SL/TP in edit modal
- ✅ **Portfolio:**
  - Virtual USDT balance
  - **Available balance** (reserves open limit order margins)
  - Locked balance (active strategies)
  - Trade history
  - Fee calculation (0.1% default)

### 5.4 Strategy Builder
- ✅ **Pine Script Integration:**
  - Custom DSL editor (CodeMirror)
  - Syntax highlighting
  - **Transpiler:** Pine Script → Python
    - `parser.py`: Tokenizes Pine Script syntax
    - `generator.py`: Generates executable Python code
  - Strategy compilation & storage (bytecode in DB)
- ✅ **Strategy Management:**
  - Create/Edit/Delete strategies
  - Favorite marking (star icon)
  - Category organization
  - Status tracking (draft/testing/active/disabled)
- ✅ **Backtesting:**
  - Historical data simulation
  - Performance metrics
  - Risk-adjusted returns

### 5.5 AI Research Agent
- ✅ **Market Analysis:**
  - Gemini AI integration (google-generativeai)
  - Real-time market data injection (via `MarketService`)
  - Technical indicator context (RSI, MACD, Bollinger Bands)
  - Prompt types:
    - Trend Analysis
    - News Summary
    - Custom Inquiry
- ✅ **Document Management:**
  - Save analysis reports (Markdown)
  - Folder organization
  - Tag system (JSONB array)
  - Search & filter
  - Delete with confirmation modal
- ✅ **UI Features:**
  - Split-view layout (Chart + Document Viewer)
  - Markdown rendering (react-markdown)
  - Auto-scroll to latest analysis
  - Clear button
  - Enter-to-submit

### 5.6 Indicator Matrix
- ✅ Custom indicator library
- ✅ Favorite indicators (persistent)
- ✅ Quick-add to chart
- ✅ Parameter customization

### 5.7 Settings & Configuration
- ✅ **API Key Management:**
  - Multi-provider support (Gemini, OpenAI, Binance, Bitget)
  - Encrypted storage (AES-256)
  - Validation status tracking
  - Model selection (e.g., "gemini-1.5-pro")
- ✅ **Exchange Configuration:**
  - Binance API integration (CCXT)
  - Real-time data feeds (WebSocket)
  - Paper trading mode (no real funds)

### 5.8 User Experience Improvements (NEW - 2025-12-08)
- ✅ **Custom Confirmation Modals:**
  - Order cancellation modal ("Yes, Cancel Order" / "No, Keep Order")
  - Strategy deletion modal
- ✅ **Trade Result Modal:**
  - Displays PnL after position close
  - Shows entry/close price, size, percentage gain/loss
  - Color-coded (green for profit, red for loss)
- ✅ **AlertModal:**
  - Replaced native browser alerts with custom modal
  - Fixes "fleeting alert" issue

---

## 6. Data Flow Architecture

### 6.1 Real-Time Price Updates
```
Binance WebSocket → Frontend (KlineChartCore.tsx)
                  ↓
            Chart update via applyNewData()
                  ↓
            KlineCharts internal re-render
```

**Optimization:** KlineCharts handles internal state efficiently with minimal re-renders.

### 6.2 Order Execution Flow
```
Frontend (OrderEntry) → Backend API (/api/v1/paper/order)
                      ↓
                Paper Trading Service
                      ↓
                Database (paper_orders, paper_positions)
                      ↓
                Response → Frontend (TradeResultModal if position close)
```

### 6.3 AI Analysis Flow
```
Frontend (ResearchAgent) → Backend API (/api/v1/research/analyze)
                         ↓
                   MarketService (fetch OHLCV + indicators)
                         ↓
                   Gemini AI (prompt with market context)
                         ↓
                   Streaming response → Frontend
                         ↓
                   Save to user_documents (optional)
```

### 6.4 Strategy Execution Flow
```
Pine Script (Frontend) → Backend API (/api/v1/strategies)
                       ↓
                 Strategy Engine (transpiler)
                       ↓
                 parser.py → AST
                       ↓
                 generator.py → Python code
                       ↓
                 Compile & store (compiled_artifact)
                       ↓
                 Execute on market data (strategy-engine service)
```

---

## 7. Performance Optimizations

### 7.1 Frontend
- **KlineCharts:** Professional-grade chart rendering optimized for real-time data
- **WebSocket Management:** Auto-reconnect with exponential backoff
- **Code Splitting:** React Router lazy loading
- **State Management:** Zustand (lightweight, no Provider overhead)

### 7.2 Backend
- **Async I/O:** FastAPI + asyncpg (non-blocking database queries)
- **Connection Pooling:** SQLAlchemy async engine
- **Caching:** Redis for session data & frequently accessed market data
- **Database Indexing:** 
  - `username`, `email` (unique indexes)
  - `user_id` (foreign key indexes)
  - `symbol`, `timeframe` (composite indexes for queries)

### 7.3 Database
- **TimescaleDB:** Optimized for time-series data (OHLCV, trades)
- **JSONB:** Efficient storage for dynamic data (preferences, parameters)
- **Partitioning:** (Future) Time-based partitioning for `ledger_entries`

---

## 8. Security Measures

### 8.1 Data Protection
- ✅ **Passwords:** Argon2 hashing (memory-hard, GPU-resistant)
- ✅ **API Keys:** AES-256 encryption with nonce
- ✅ **Secrets:** Docker secrets (not in environment variables)
- ✅ **Database:** Isolated network (`data_net`)

### 8.2 Network Security
- ✅ **AI Sentinel:** No internet access (prevents data exfiltration)
- ✅ **Internal Networks:** `app_net` for inter-service communication
- ✅ **CORS:** Configured for frontend origin only

### 8.3 Audit & Compliance
- ✅ **Ledger Entries:** Blockchain-style hash chain (immutable log)
- ✅ **Timestamps:** All actions timestamped (UTC)
- ✅ **User Tracking:** `signer_id` for accountability

### 8.4 Future Enhancements
- ⏳ HTTPS/TLS (production deployment)
- ⏳ Rate limiting (API abuse prevention)
- ⏳ 2FA (Two-Factor Authentication)
- ⏳ API key rotation (automated)

---

## 9. Development Workflow

### 9.1 Local Development
```bash
# Start all services
cd infra
docker-compose up -d

# Access points
Frontend: http://localhost:5173
Backend API: http://localhost:8000
Strategy Engine: http://localhost:8001
```

### 9.2 Database Migrations
```bash
# Generate migration
cd backend
poetry run alembic revision --autogenerate -m "description"

# Apply migration
poetry run alembic upgrade head
```

### 9.3 Testing
```bash
# Backend tests
cd backend
poetry run pytest

# Frontend tests (if configured)
cd frontend
npm run test
```

---

## 10. Recent Changes (2025-12-08)

### 10.1 Chart Drawing Tools
- **New Component:** `DrawingToolbar.tsx`
  - Collapsible left sidebar (TradingView-style)
  - Tool groups: Lines, Trend Lines, Fibonacci, Channels, Annotations
  - Keyboard support: Delete/Backspace to remove selected overlay, ESC to cancel
- **KlineChartCore Integration:**
  - `startDrawing()` with onSelected/onDeselected callbacks
  - `selectedOverlayId` state tracking
  - `toggleOverlayVisibility()` and `toggleOverlayLock()` functions

### 10.2 Trading UX Improvements
- **Available Balance:** Reserves margin for open limit orders
- **Confirmation Modals:** Custom modals for order cancellation and strategy deletion
- **Trade Result Modal:** Shows PnL after closing position

### 10.3 Removed Features
- **Shapes (Circle, Rect, Triangle):** Not built-in to KlineCharts, would require custom overlay registration

---

## 11. Known Issues & Limitations

### 11.1 Current Limitations
- **AI Sentinel:** Requires proxy for OpenAI access (currently isolated)
- **Pine Script:** Limited DSL support (subset of TradingView Pine Script)
- **Backtesting:** Single-threaded execution (slow for large datasets)
- **Real Trading:** Not yet implemented (paper trading only)
- **Drawing Tools:** simpleAnnotation/simpleTag show markers only (no text input dialog)

### 11.2 Technical Debt
- **TypeScript Warnings:** Some unused variable warnings in legacy D3Chart components
- **KlineCharts Types:** Module declaration not found (runtime works correctly)

---

## 12. Deployment Considerations

### 12.1 Production Checklist
- [ ] Change `SECRET_KEY` to cryptographically secure value
- [ ] Enable HTTPS/TLS (reverse proxy: Nginx/Traefik)
- [ ] Configure CORS for production domain
- [ ] Set up automated backups (PostgreSQL + Redis)
- [ ] Implement monitoring (Prometheus + Grafana)
- [ ] Configure log aggregation (ELK stack)
- [ ] Enable rate limiting (API gateway)
- [ ] Set up CI/CD pipeline (GitHub Actions)

### 12.2 Scaling Strategy
- **Horizontal Scaling:** 
  - Frontend: CDN + multiple instances
  - Backend: Load balancer + multiple FastAPI instances
  - Strategy Engine: Queue-based execution (Celery + Redis)
- **Database:** 
  - Read replicas for analytics
  - Connection pooling (PgBouncer)
- **Caching:** 
  - Redis Cluster for high availability

---

## 13. Future Roadmap

### 13.1 Planned Features
- [ ] **Live Trading:** Real exchange integration (Binance, Bitget)
- [ ] **Advanced Order Types:** OCO, Iceberg, TWAP
- [ ] **Portfolio Analytics:** Sharpe ratio, max drawdown, win rate
- [ ] **Social Trading:** Copy trading, leaderboard
- [ ] **Mobile App:** React Native (iOS/Android)
- [ ] **Notifications:** Email, Telegram, Discord webhooks
- [ ] **Multi-Exchange:** Aggregate liquidity across exchanges
- [ ] **Custom Shapes:** Register circle, rect, triangle as custom overlays

### 13.2 Technical Improvements
- [ ] **GraphQL API:** Replace REST for complex queries
- [ ] **WebAssembly:** Pine Script execution in browser
- [ ] **Machine Learning:** Predictive models (TensorFlow/PyTorch)
- [ ] **Microservices:** Split backend into domain services
- [ ] **Event Sourcing:** CQRS pattern for trading events
- [ ] **10s/30s Timeframes:** Aggregate 1s ticks (currently deprioritized)

---

## 14. Contact & Support

**Project Repository:** https://github.com/WizardofTryout/autarkic-trading-platform  
**Branch:** `001-autarkic-trading-platform`  
**Documentation:** (Add docs URL)  
**Issue Tracker:** (Add issue tracker URL)

---

**Document Version:** 2.0  
**Last Review:** 2025-12-08  
**Next Review:** 2025-12-22
