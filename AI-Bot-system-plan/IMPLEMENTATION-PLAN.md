# 🚀 AI Trading Fleet - Implementation Plan

**Projekt:** Autarkic Trading Platform  
**Modul:** Autonomous AI Trading Fleet  
**Erstellt:** 2025-12-08  
**Status:** Bereit zur Implementierung

---

## 📋 Übersicht

Dieses Dokument beschreibt die schrittweise Implementierung des AI Trading Fleet Systems.

**Gesamtdauer (geschätzt):** 4-6 Wochen  
**Phasen:** 4 Hauptphasen

---

## ⚠️ WICHTIGE CONSTRAINTS

### Docker-Only Environment
> **KEINE lokalen Installationen!** Alles muss in Docker-Containern laufen.

| Regel | Details |
|-------|---------|
| Python Dependencies | Nur in `backend/pyproject.toml` + Container rebuild |
| Celery Worker | Neuer Docker-Service in `docker-compose.yml` |
| Node.js Dependencies | Nur in `frontend/package.json` + Container rebuild |
| Datenbank-Migrationen | Via `docker exec backend alembic upgrade head` |

### UI Preservation (Nicht zerstören!)
> **Bestehendes Layout NICHT ändern!** Nur additive Ergänzungen.

| Bereich | Erlaubt | NICHT erlaubt |
|---------|---------|---------------|
| **Dashboard** | Neuen Tab "Fleet" hinzufügen | Bestehende Tabs verschieben |
| **Sidebar** | Neues Icon "🤖 Agents" einfügen | Bestehende Navigation ändern |
| **Order Book** | Spalte "Source" hinzufügen | Spalten-Reihenfolge ändern |
| **Modals** | Neue Modals für Fleet UI | Bestehende Modals überschreiben |
| **Chart** | Agent-Overlays als Layer | Chart-Core-Logik ändern |

---

## Phase 1: Infrastructure & Database ✅
**Dauer:** ~1 Woche  
**Status:** [x] ABGESCHLOSSEN (2025-12-08)

### 1.1 Docker-Infrastruktur erweitern
- [x] **1.1.1** Celery Worker Service zu `docker-compose.yml` hinzufügen
  - **File:** `infra/docker-compose.yml`
  - **Docker Service Definition:**
    ```yaml
    celery_worker:
      build:
        context: ../backend
        dockerfile: Dockerfile
      container_name: celery_worker
      command: celery -A app.core.celery_app worker --loglevel=info
      volumes:
        - ../backend:/app
      environment:
        - CELERY_BROKER_URL=redis://redis:6379/0
        - DATABASE_URL=${DATABASE_URL}
      depends_on:
        - redis
        - ledger-db
      networks:
        - app_net
        - data_net
      restart: unless-stopped
    ```
  - **Abhängigkeit:** Redis Container muss laufen

- [x] **1.1.2** Celery Beat Service (Scheduler) hinzufügen
  - **File:** `infra/docker-compose.yml`
  - **Docker Service Definition:**
    ```yaml
    celery_beat:
      build:
        context: ../backend
        dockerfile: Dockerfile
      container_name: celery_beat
      command: celery -A app.core.celery_app beat --loglevel=info
      volumes:
        - ../backend:/app
      environment:
        - CELERY_BROKER_URL=redis://redis:6379/0
      depends_on:
        - redis
        - celery_worker
      networks:
        - app_net
      restart: unless-stopped
    ```

- [x] **1.1.3** Celery App Konfiguration erstellen
  - **File:** `backend/app/core/celery_app.py`
  - **Code:**
    ```python
    from celery import Celery
    from celery.schedules import crontab
    import os

    celery_app = Celery(
        "autarkic_trading",
        broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
        include=["app.tasks.cleanup_logs"]
    )

    celery_app.conf.beat_schedule = {
        "cleanup-old-logs": {
            "task": "app.tasks.cleanup_logs.cleanup_agent_logs",
            "schedule": crontab(minute=0),  # Every hour
        },
    }
    ```

- [x] **1.1.4** Celery zu `backend/pyproject.toml` Dependencies hinzufügen
  - **Neue Dependencies:**
    ```toml
    celery = "^5.3.0"
    redis = "^5.0.0"
    ```
  - **Danach:** `docker-compose build backend celery_worker celery_beat`

### 1.2 Datenbank-Schema erweitern
- [x] **1.2.1** SQLAlchemy Model für `trading_agents` Tabelle
  - **File:** `backend/alembic/versions/xxx_create_trading_agents.py`
  - **Schema:**
    ```sql
    trading_agents:
      - id: UUID (PK)
      - user_id: UUID (FK → users)
      - name: VARCHAR(50)
      - symbol: VARCHAR(20)
      - mode: ENUM('PAPER', 'LIVE')
      - status: ENUM('SCANNING', 'PROPOSING', 'ACTIVE', 'PAUSED', 'STOPPED')
      - budget: DECIMAL(20,8)
      - locked_budget: DECIMAL(20,8)
      - max_drawdown_percent: DECIMAL(5,2) DEFAULT 10.0
      - session_pnl: DECIMAL(20,8) DEFAULT 0
      - macro_strategy_id: UUID (FK → strategies)
      - micro_strategy_id: UUID (FK → strategies)
      - macro_timeframe: VARCHAR(10) DEFAULT '4h'
      - micro_timeframe: VARCHAR(10) DEFAULT '15m'
      - created_at: TIMESTAMP
      - updated_at: TIMESTAMP
    ```

- [x] **1.2.2** SQLAlchemy Model für `agent_logs` Tabelle
  - **File:** `backend/alembic/versions/xxx_create_agent_logs.py`
  - **Schema:**
    ```sql
    agent_logs:
      - id: UUID (PK)
      - agent_id: UUID (FK → trading_agents)
      - timestamp: TIMESTAMP DEFAULT NOW()
      - status: VARCHAR(20)
      - log_text: TEXT
      - visual_snapshot: JSONB
      - meta_data: JSONB
    INDEX: idx_agent_logs_timestamp ON (timestamp)
    ```

- [x] **1.2.3** SQLAlchemy Models erstellen (in `base.py` integriert)
  - **File:** `backend/app/models/trading_agent.py`
  - **Details:** TradingAgent und AgentLog Klassen

- [x] **1.2.4** Pydantic Schemas erstellen
  - **File:** `backend/app/schemas/trading_agent.py`
  - **Details:** Create, Update, Response Schemas

### 1.3 Cleanup-Task implementieren
- [x] **1.3.1** Celery Task für Log-Bereinigung
  - **File:** `backend/app/tasks/cleanup_logs.py`
  - **Details:** `DELETE FROM agent_logs WHERE timestamp < NOW() - INTERVAL '15 days'`
  - **Schedule:** Jede Stunde via Celery Beat

---

## Phase 2: Backend Core Logic ✅
**Dauer:** ~1.5 Wochen  
**Status:** [x] ABGESCHLOSSEN (2025-12-08)  
**Abhängigkeit:** Phase 1 abgeschlossen

### 2.1 Trading Agent Core Class
- [x] **2.1.1** `TradingAgentInstance` Klasse erstellen
  - **File:** `backend/app/services/trading_agent_instance.py`
  - **Properties:**
    - `agent_id`, `mode`, `symbol`, `status`
    - `macro_strategy`, `micro_strategy`
    - `budget`, `max_drawdown_percent`
  - **Methoden:**
    - `start()`, `pause()`, `stop()`
    - `analyze_macro()`, `analyze_micro()`
    - `calculate_position_size()`, `validate_rr()`

- [x] **2.1.2** Multi-Timeframe Data Fetcher (integriert in TradingAgentInstance)
  - **File:** `backend/app/services/mtf_data_service.py`
  - **Details:** Paralleler Fetch von 4h + 15m OHLCV Daten
  - **Verwendet:** Bestehender `MarketService`

- [x] **2.1.3** Strategy Executor integrieren (Placeholder, vorbereitet)
  - **File:** `backend/app/services/strategy_executor.py`
  - **Details:** Python-Code aus `strategies.python_code` ausführen
  - **Input:** DataFrame (OHLCV)
  - **Output:** Signals (LONG/SHORT/NEUTRAL)

### 2.2 Agent Fleet Manager
- [x] **2.2.1** `AgentFleetManager` Service erstellen
  - **File:** `backend/app/services/fleet_manager.py`
  - **Details:** 
    - Dictionary aller laufenden Agent-Instanzen
    - `deploy_agent()`, `stop_agent()`, `get_fleet_status()`
  - **Concurrency:** `asyncio.gather` für parallele Agents

- [x] **2.2.2** Budget-Locking Logic (im FleetManager integriert)
  - **File:** `backend/app/services/paper_trading.py` (erweitern)
  - **Details:** 
    - Bei Agent-Deploy: `paper_account.locked_balance += agent_budget`
    - Bei Agent-Stop: `paper_account.locked_balance -= agent_budget`

### 2.3 WebSocket Fleet Endpoint
- [x] **2.3.1** Redis Pub/Sub Setup (im FleetManager + WS)
  - **File:** `backend/app/core/redis_pubsub.py`
  - **Channel:** `fleet_updates`
  - **Details:** Agents publishen, WebSocket subscribed

- [x] **2.3.2** WebSocket Endpoint `/ws/fleet/stream`
  - **File:** `backend/app/api/websockets/fleet_stream.py`
  - **Details:**
    - JWT Authentication erforderlich
    - Subscribed to Redis Channel
    - Push Agent-Status + Visuals an Frontend

- [x] **2.3.3** Message Format definieren
  - **Payload:**
    ```json
    {
      "agent_id": "uuid",
      "type": "status" | "thought" | "trade",
      "symbol": "BTC/USDT",
      "status": "PROPOSING",
      "log": "RSI Divergence detected...",
      "visuals": [
        { "shape": "line", "price": 95000, "color": "green", "label": "Entry" }
      ],
      "timestamp": "2025-12-08T12:00:00Z"
    }
    ```

### 2.4 REST API Endpoints
- [x] **2.4.1** CRUD für Trading Agents
  - **File:** `backend/app/api/api_v1/endpoints/fleet.py`
  - **Endpoints:**
    - `POST /api/v1/fleet/agents` - Deploy neuen Agent
    - `GET /api/v1/fleet/agents` - Liste aller Agents
    - `GET /api/v1/fleet/agents/{id}` - Agent Details
    - `PATCH /api/v1/fleet/agents/{id}` - Update Agent (Pause, Config)
    - `DELETE /api/v1/fleet/agents/{id}` - Stop & Remove Agent

- [x] **2.4.2** Agent Control Endpoints
  - **Endpoints:**
    - `POST /api/v1/fleet/agents/{id}/start` - Agent starten
    - `POST /api/v1/fleet/agents/{id}/pause` - Agent pausieren
    - `POST /api/v1/fleet/agents/{id}/approve` - Trade genehmigen (Human-in-the-Loop)

---

## Phase 3: Exchange Integration (Live Mode)
**Dauer:** ~1 Woche  
**Status:** [ ] Nicht gestartet  
**Abhängigkeit:** Phase 2 abgeschlossen

### 3.1 Hybrid Order Execution
- [ ] **3.1.1** Order Router erweitern
  - **File:** `backend/app/services/order_router.py`
  - **Details:** 
    - `mode == 'PAPER'` → PaperTradingService
    - `mode == 'LIVE'` → CCXTLiveService

- [ ] **3.1.2** CCXT Live Connector
  - **File:** `backend/app/services/ccxt_live_service.py`
  - **Details:**
    - Decrypt API Keys aus `vault_keys`
    - Binance Spot/Futures Order Placement
    - Rate Limiting (max 10 Orders/Sekunde)

- [ ] **3.1.3** Security Checks für Live Mode
  - **Details:**
    - Validate API Key vor Order
    - IP Whitelist Check (wenn aktiviert)
    - Max Order Size Limit

### 3.2 Order Source Tagging
- [ ] **3.2.1** `source` Spalte zu `paper_orders` hinzufügen
  - **Migration:** ALTER TABLE paper_orders ADD source VARCHAR(50);
  - **Values:** `'MANUAL'` | `'AUTO:AgentName'`

- [ ] **3.2.2** Frontend Order Book erweitern
  - **File:** `frontend/src/components/Dashboard/TradingDashboard.tsx`
  - **Details:** Neue Spalte "Source" mit Badge (Manual/Auto)

---

## Phase 4: Frontend "Mission Control"
**Dauer:** ~1.5 Wochen  
**Status:** [ ] Nicht gestartet  
**Abhängigkeit:** Phase 2.3 (WebSocket) abgeschlossen

### 4.0 UI Integration Approach (WICHTIG!)
> **Regel:** Bestehendes Layout NICHT verändern. Nur additive Ergänzungen!

**Integration Points:**

| Wo | Was hinzufügen | Wie |
|----|----------------|-----|
| `TradingDashboard.tsx` | Neuer Tab "Fleet" | `activeTab: 'fleet'` hinzufügen, Case-Block ergänzen |
| Sidebar/Navigation | Icon "🤖 Agents" | Nach bestehendem letzten Icon einfügen |
| Order Book Tabelle | Spalte "Source" | Als letzte Spalte nach "Actions" |

**Beispiel Tab-Integration:**
```tsx
// In TradingDashboard.tsx - bestehenden Code erweitern, NICHT ersetzen
const [activeTab, setActiveTab] = useState<
  'positions' | 'orders' | 'history' | 'strategies' | 'fleet'  // 'fleet' hinzufügen
>('positions');

// Im Tab-Bereich:
<button onClick={() => setActiveTab('fleet')}>
  🤖 Fleet
</button>

// Im Content-Bereich:
{activeTab === 'fleet' && <FleetDashboard />}
```

### 4.1 Fleet Dashboard
- [ ] **4.1.1** Fleet Overview Komponente (NEUE Datei, nichts überschreiben)
  - **File:** `frontend/src/components/Fleet/FleetDashboard.tsx`
  - **Features:**
    - Tabelle: Agent Name | Pair | Mode | Status | PnL | Kill Switch
    - Live PnL Updates via WebSocket
    - Farbkodierung: 🟢 ACTIVE, 🟡 PROPOSING, ⚪ SCANNING, 🔴 STOPPED

- [ ] **4.1.2** "Deploy Agent" Wizard
  - **File:** `frontend/src/components/Fleet/DeployAgentModal.tsx`
  - **Steps:**
    1. Name & Symbol wählen
    2. Mode wählen (Paper/Live)
    3. Macro Strategy auswählen
    4. Micro Strategy auswählen
    5. Budget & Kill Switch konfigurieren
    6. Bestätigen

- [ ] **4.1.3** Fleet Store (Zustand)
  - **File:** `frontend/src/store/fleetStore.ts`
  - **State:** `agents[]`, `selectedAgentId`, `wsConnection`
  - **Actions:** `deployAgent()`, `pauseAgent()`, `approveProposal()`

### 4.2 Agent Detail View (Cockpit)
- [ ] **4.2.1** Agent Cockpit Komponente
  - **File:** `frontend/src/components/Fleet/AgentCockpit.tsx`
  - **Layout:**
    - Links: KlineCharts mit Agent Overlays
    - Rechts oben: Live Log Terminal
    - Rechts unten: Controls (GO, PAUSE, STOP)

- [ ] **4.2.2** Custom KlineCharts Overlays für "Ghost Lines"
  - **File:** `frontend/src/components/Chart/AgentOverlays.ts`
  - **Overlays:**
    - `agent_entry_line` (gestrichelt, grün)
    - `agent_sl_line` (gestrichelt, rot)
    - `agent_tp_line` (gestrichelt, blau)
    - `agent_zone_box` (halbtransparentes Rechteck)

- [ ] **4.2.3** WebSocket Hook für Fleet Stream
  - **File:** `frontend/src/hooks/useFleetWebSocket.ts`
  - **Details:**
    - Connect zu `/ws/fleet/stream`
    - JWT Token mitsenden
    - Parse Messages und update Store

### 4.3 Agent Chat Interface
- [ ] **4.3.1** Chat Komponente für Agent-Dialog
  - **File:** `frontend/src/components/Fleet/AgentChat.tsx`
  - **Features:**
    - "Warum dieses Signal?" → Agent erklärt
    - Context: Aktueller Agent-Status + Visuals

- [ ] **4.3.2** Backend Chat Endpoint
  - **File:** `backend/app/api/api_v1/endpoints/fleet.py` (erweitern)
  - **Endpoint:** `POST /api/v1/fleet/agents/{id}/chat`
  - **Details:** Gemini mit Agent-Kontext prompten

---

## Abhängigkeitsdiagramm

```
Phase 1 (Infrastructure)
    │
    ├─── 1.1 Docker ──────┐
    ├─── 1.2 Database ────┼──▶ Phase 2 (Backend Core)
    └─── 1.3 Cleanup ─────┘         │
                                     ├─── 2.1 Agent Class
                                     ├─── 2.2 Fleet Manager
                                     ├─── 2.3 WebSocket ──────▶ Phase 4 (Frontend)
                                     └─── 2.4 REST API
                                              │
                                              ▼
                                     Phase 3 (Live Trading)
```

---

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| LLM Halluzination | Agent führt NUR Python-Strategien aus, kein spontanes LLM-Trading |
| Live Trading Fehler | Immer erst Paper Mode testen, Kill Switch aktiv |
| WebSocket Überlastung | Rate Limiting auf Agent-Logs (max 1 msg/s pro Agent) |
| Budget Überziehung | Strikte `locked_balance` Prüfung vor jedem Trade |

---

## Checkpoint-Reviews

- [ ] **Review 1:** Nach Phase 1 - DB Schema + Docker OK?
- [ ] **Review 2:** Nach Phase 2.2 - Fleet Manager funktioniert?
- [ ] **Review 3:** Nach Phase 2.3 - WebSocket Messages kommen an?
- [ ] **Review 4:** Nach Phase 4.1 - Dashboard zeigt Agents?
- [ ] **Final Review:** End-to-End Test eines Paper-Trading Agents

---

**Nächster Schritt:** Phase 1.1.1 - Celery Worker zu Docker hinzufügen

---

*Dokument Version: 1.0*  
*Letzte Aktualisierung: 2025-12-08*
