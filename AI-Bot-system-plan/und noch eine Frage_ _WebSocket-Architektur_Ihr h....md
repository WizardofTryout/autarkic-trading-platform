# **🚀 FINAL SPECIFICATION: Autonomous AI Trading Fleet**

Project: Autarkic Trading Platform  
Module: Execution Engine, Workers & Networking  
Date: December 8, 2025  
Version: 2.2 (Separate WS \+ Celery)  
Status: Approved for Implementation

## **1\. STRATEGIC DECISIONS (Answers to Dev Questions)**

| Topic | Decision / Requirement |
| :---- | :---- |
| **1\. Execution Mode** | **Hybrid.** Support both PAPER and LIVE modes. LIVE uses encrypted User API Keys. |
| **2\. Analysis Logic** | **Autonomous Multi-Timeframe.** Macro (4h) validates Micro (15m). |
| **3\. Data Persistence** | **Celery Queue.** Use Celery for background cleanup of high-volume logs. |
| **4\. Kill Switch** | **Configurable.** Default 10% drawdown. User override allowed. |
| **5\. WebSocket Arch** | **Separated Channels.** Use a dedicated private endpoint /api/v1/fleet/stream for agent thoughts. Do NOT mix with public market data. |

## **2\. INFRASTRUCTURE: WORKERS & NETWORKING**

### **2.1 New Service: Celery Worker**

We add a dedicated worker service to the Docker stack to handle heavy background tasks (Cleanup, ML Inference).

| Service | Container | Purpose |
| :---- | :---- | :---- |
| **Backend** | backend | API & WebSocket Hub (Producers) |
| **Redis** | redis | Message Broker for Celery & WS Pub/Sub |
| **Worker** | celery\_worker | **NEW:** Executes cleanup & heavy lifting |

### **2.2 WebSocket Architecture (Separation of Concerns)**

We strictly separate public market data from private agent intelligence.

* **Public Stream:** /ws/market/{symbol} (Existing) \-\> High Frequency Ticks.  
* **Private Fleet Stream:** /ws/fleet/stream (Authenticated) \-\> Agent Status, Visuals, Logs.

## **3\. DATA PERSISTENCE & RETENTION**

### **3.1 The "High-Frequency" Table**

**Table:** agent\_logs

CREATE TABLE agent\_logs (  
    id UUID PRIMARY KEY,  
    agent\_id UUID REFERENCES trading\_agents(id),  
    timestamp TIMESTAMP DEFAULT NOW(),  
    status VARCHAR(20),       \-- "PROPOSING", "SCANNING"  
    log\_text TEXT,  
    visual\_snapshot JSONB,    \-- Coordinates for chart overlays  
    meta\_data JSONB  
);  
CREATE INDEX idx\_agent\_logs\_timestamp ON agent\_logs(timestamp);

### **3.2 The Celery Cleanup Task**

* **Task Name:** tasks.cleanup\_logs  
* **Schedule:** Every hour (Celery Beat).  
* **Logic:** Delete logs older than 15 days in chunks.

## **4\. CORE LOGIC: THE AGENT FLEET**

### **4.1 Backend Class (TradingAgentInstance)**

Manages the lifecycle of ONE trading pair via asyncio loop in the main backend.

### **4.2 The Communication Loop**

1. **Think:** Agent calculates Signal.  
2. **Broadcast:** Agent pushes message to Redis Channel fleet\_updates.  
3. **Deliver:** FastAPI WebSocket Endpoint (/ws/fleet/stream) subscribes to Redis and pushes to Frontend.

**Payload Example:**

{  
  "agent\_id": "uuid",  
  "type": "thought",   
  "visuals": \[{ "shape": "rect", "x1": 167000, "y1": 50000, "color": "green" }\]  
}

## **5\. FRONTEND: MISSION CONTROL (KlineCharts)**

### **5.1 Fleet Dashboard**

Table: Agent Name | Pair | Mode | Status | PnL | Kill Switch %

### **5.2 Agent Cockpit**

* **Chart:** KlineChartCore rendering the visuals from the **Private WebSocket**.  
* **Controls:** \[GO\] button for Human-in-the-Loop approval.

## **6\. IMPLEMENTATION ROADMAP (Prioritized)**

### **Phase 1: Infrastructure & DB**

* \[ \] **Docker:** Add celery\_worker to compose file.  
* \[ \] **DB:** Create trading\_agents and agent\_logs tables.

### **Phase 2: Networking & Logic**

* \[ \] **WebSockets:** Implement /ws/fleet/stream endpoint with Redis Pub/Sub.  
* \[ \] **Class:** Implement TradingAgentInstance.

### **Phase 3: Interface**

* \[ \] **UI:** Build Fleet Dashboard and connect to new WebSocket.

Developer Note:  
Ensure the new WebSocket endpoint requires JWT Authentication (same as REST API).