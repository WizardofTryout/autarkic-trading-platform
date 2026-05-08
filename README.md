# Autarkic Trading Platform

Production-grade, multi-service trading platform with a React 19 frontend, FastAPI backend, TimescaleDB ledger, Redis, Celery background jobs, a sandboxed strategy engine, and an isolated AI sentinel service.

## Disclaimer

This software is for educational and research purposes only. Do not risk money you are afraid to lose. Use the software at your own risk. The authors and contributors assume no responsibility for your trading results.

## Platform Preview

![Dashboard](docs/assets/dashboard.png)

## Table of Contents

- Overview
- Capabilities (Highlights)
- Architecture and Service Map
- Core Flows
- Tech Stack
- Data Model (Key Tables)
- API Surface (High-Level)
- Quick Start (Docker)
- Local Development (Without Docker)
- Configuration and Secrets
- Observability and Troubleshooting
- Security and Data Hygiene
- Contributing
- Roadmap
- License

## Overview

The platform orchestrates autonomous trading agents that analyze multi-timeframe market data, generate proposals, and execute trades only after explicit approval. It combines strict network isolation with a sandboxed strategy execution model and a centralized fleet manager.

## Capabilities (Highlights)

- Agent lifecycle: PAUSED -> SCANNING -> PROPOSING -> AWAITING_APPROVAL -> ACTIVE -> IN_POSITION -> COOLDOWN
- Fleet manager: registry of active agents, budget locking, and real-time status broadcasting via Redis WebSockets
- Sandboxed strategy execution: Python sandbox with restricted imports (pandas/numpy only)
- Market data ledger: high-frequency OHLCV caching with retention policies using TimescaleDB
- Background orchestration: scheduled cleanup of logs and market data via Celery Beat

## Architecture and Service Map

```mermaid
graph TD;
  UI["Frontend (React Vite)"] -->|"HTTP/WS"| API["Backend (FastAPI)"];
  API -->|"SQL"| DB[("TimescaleDB")];
  API -->|"Broker/Cache"| R[("Redis")];
  API -->|"Sandboxed Exec"| SE["Strategy Engine"];
  R -->|"Tasks"| CW["Celery Worker"];
  R -->|"Schedules"| CB["Celery Beat"];
  CW -->|"Read/Write"| DB;
  SE -->|"Market Data"| DB;
  API -->|"Internal"| AS["AI Sentinel"];

  subgraph Networks
    PN["public_net"];
    AN["app_net"];
    DN["data_net"];
  end;
```

### Service Map

| Service | Port | Purpose | Network |
| --- | --- | --- | --- |
| frontend | 5173 | React UI and charting | public_net, app_net |
| backend | 8000 | Core API, agent orchestration | public_net, app_net, data_net |
| strategy-engine | 8001 | Sandboxed strategy execution | app_net, data_net |
| ai-sentinel | - | Isolated AI analysis | app_net |
| ledger-db | 5432 | TimescaleDB ledger | data_net |
| redis | 6379 | Message broker and cache | app_net, data_net |
| celery_worker | - | Background tasks | app_net, data_net |
| celery_beat | - | Scheduled tasks | app_net |

## Core Flows

### Agent Lifecycle

1. Fetch macro (4h) and micro (15m) data
2. Execute strategy code in sandboxed namespace
3. Synthesize signals and generate proposal with risk markers
4. Await user approval
5. Execute trade, monitor position, then cooldown

### Market Data and Retention

- OHLCV data is cached by timeframe with retention policies per timeframe
- Celery Beat schedules collection and cleanup tasks

### Strategy Execution

- User strategy code is transpiled to Python and executed in the strategy engine
- Only pandas and numpy are available in the sandbox

### Fleet Updates

- Fleet manager emits updates via Redis channels
- UI consumes and renders real-time status changes

## Tech Stack

### Frontend

- React 19 + Vite
- TailwindCSS
- Zustand
- KlineCharts + Lightweight Charts + D3
- React Router

### Backend

- FastAPI + Uvicorn
- SQLAlchemy (async)
- Celery + Redis
- CCXT (exchange integration)
- pandas + numpy

### Data

- TimescaleDB (PostgreSQL 15)
- Redis (cache + broker)

### Services

- strategy-engine: sandboxed Python execution for strategies
- ai-sentinel: isolated AI analysis service

## Data Model (Key Tables)

The database contains core entities for agents, market data, and paper trading. Key tables include:

- TradingAgent (budget, status, leverage, lifecycle)
- AgentLog (high-frequency logs, cleaned hourly by Celery)
- OHLCVCache (time-series market data with retention)
- PaperAccount, PaperPosition, PaperOrder, PaperTrade (paper trading simulation)
- Strategy (Pine Script and generated Python code)

## API Surface (High-Level)

Base URL: `http://localhost:8000`

- `GET /health` health check
- `GET /api/v1/openapi.json` OpenAPI schema

Primary routers:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/settings`
- `/api/v1/strategies`
- `/api/v1/market`
- `/api/v1/trade`
- `/api/v1/paper`
- `/api/v1/fleet`
- `/api/v1/fleet/ws`
- `/api/v1/history`
- `/api/v1/ai`
- `/api/v1/ai-strategy`
- `/api/v1/research`

Example requests:

```bash
curl http://localhost:8000/health
```

```bash
curl http://localhost:8000/api/v1/strategies
```

```bash
curl http://localhost:8000/api/v1/fleet
```

## Quick Start (Docker)

### Prerequisites

- Docker Desktop (or compatible Docker Engine)
- Docker Compose

### Environment Configuration

Create the required secret file and optional environment variables.

```bash
mkdir -p infra/secrets
echo "your_super_secret_password" > infra/secrets/db_password.txt
```

If you use an `.env` file:

```bash
touch infra/.env
```

Required environment variables (examples):

| Variable | Description | Example |
| --- | --- | --- |
| POSTGRES_SERVER | Database hostname | ledger-db |
| POSTGRES_DB | Database name | trading_db |
| REDIS_URL | Redis connection string | redis://redis:6379/0 |
| EXCHANGE_API_KEY | Optional CCXT key | sk-123... |

### Launch the Stack

```bash
cd infra
docker compose up -d --build
```

Access the services:

- Frontend: http://localhost:5173
- Backend API Docs: http://localhost:8000/docs
- Strategy Engine: http://localhost:8001

## Local Development (Without Docker)

This mode is intended for contributors who want to run services directly on their machine.

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15 (TimescaleDB recommended)
- Redis

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Celery

```bash
cd backend
source .venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```

### Strategy Engine

```bash
cd strategy-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuration and Secrets

### Docker

The compose file uses a Docker secret for the DB password:

- `infra/secrets/db_password.txt`

Key environment variables (examples):

```bash
POSTGRES_SERVER=ledger-db
POSTGRES_DB=trading_db
CELERY_BROKER_URL=redis://redis:6379/0
REDIS_URL=redis://redis:6379/0
```

### Local

Set your local environment variables in your shell or a private `.env` file.

## Observability and Troubleshooting

```bash
docker logs backend
docker logs celery_worker
docker logs celery_beat
docker logs frontend
```

```bash
curl http://localhost:8000/health
```

## Security and Data Hygiene

This repository intentionally excludes local-only artifacts (session notes, credentials, .env files, debug scripts, and personal research). The strategy engine executes code in a heavily restricted namespace.

## Contributing

1. Fork the repository and create a feature branch.
2. Keep changes focused and include context in the commit message.
3. Ensure Docker builds and the stack starts via `infra/docker-compose.yml`.
4. Open a PR with a short summary and screenshots for UI changes.

## Roadmap

- [ ] Hardened auth and role-based access (RBAC)
- [ ] Extended strategy SDK and backtest workflows
- [ ] Live trading connectors beyond Bitget
- [ ] OpenTelemetry structured tracing

## License

Released under the MIT License.
