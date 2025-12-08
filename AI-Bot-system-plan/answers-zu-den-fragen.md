# **🚀 FINAL SPECIFICATION: Autonomous AI Trading Fleet**

Project: Autarkic Trading Platform  
Module: Execution Engine (The Fleet)  
Date: December 8, 2025  
Status: Approved for Implementation

## **1\. STRATEGIC DECISIONS (Answers to Dev Questions)**

Based on management review, here are the binding decisions for the open questions:

| Topic | Decision / Requirement |
| :---- | :---- |
| **1\. Execution Mode** | **Hybrid.** The system must support both PAPER and LIVE modes per agent. In LIVE mode, use the encrypted User API Keys (Binance/Bitget) stored in vault\_keys. |
| **2\. Analysis Logic** | **Autonomous Multi-Timeframe.** The agent actively monitors a "Macro Trend" (e.g., 4h) to validate "Micro Signals" (e.g., 15m). It acts autonomously within the user's guardrails. |
| **3\. Data Persistence** | **Retention Policy.** Agent visuals ("Ghost Lines" / thoughts) MUST be stored in the DB for audit trails ("Why did it trade?"). **Constraint:** Implement a cleanup job to delete logs older than **15 days** to save space. |
| **4\. Kill Switch** | **Configurable.** Default is 10% drawdown pause. Users can override this value in the Agent settings (e.g., set to 5% or 20%). |

## **2\. ARCHITECTURE: THE FLEET MANAGER**

We are building a **Fleet Management System**. Users do not run "a script"; they deploy "Agents" (Workers).

### **2.1 Backend Class Design (TradingAgentInstance)**

This Python class (running in backend via asyncio) manages the lifecycle of ONE trading pair.

**Properties:**

* agent\_id: UUID  
* mode: PAPER | LIVE  
* pair: BTC/USDT  
* strategies:  
  * macro\_strategy: Python Code (e.g., Trend Filter)  
  * micro\_strategy: Python Code (e.g., Entry Trigger)  
* risk\_settings:  
  * max\_drawdown\_percent: float (Kill Switch)  
  * budget: decimal (Allocated Capital)  
* **State:** SCANNING \-\> PROPOSING \-\> ACTIVE \-\> COOLDOWN

### **2.2 The "Retention" Database Schema**

We need efficient storage for the high-frequency logs/visuals the bot produces.

**Table:** agent\_logs

CREATE TABLE agent\_logs (  
    id UUID PRIMARY KEY,  
    agent\_id UUID REFERENCES trading\_agents(id),  
    timestamp TIMESTAMP DEFAULT NOW(),  
    status VARCHAR(20),       \-- e.g. "PROPOSING"  
    log\_text TEXT,            \-- "RSI Divergence detected..."  
    visual\_snapshot JSONB,    \-- The lines/boxes drawn on chart  
    meta\_data JSONB           \-- { "price": 98000, "rsi": 32 }  
);

\-- Index for fast retention cleanup  
CREATE INDEX idx\_agent\_logs\_timestamp ON agent\_logs(timestamp);

**Retention Job (Cron):**

* Run daily: DELETE FROM agent\_logs WHERE timestamp \< NOW() \- INTERVAL '15 days';

## **3\. CORE LOGIC: THE ANALYSIS LOOP**

The agent runs an infinite loop (non-blocking).

**Step 1: Macro Check (The "Weather Report")**

* Fetch 4h Candles.  
* Execute macro\_strategy.  
* **Result:** BULLISH, BEARISH, or NEUTRAL.

**Step 2: Micro Check (The "Sniper")**

* Fetch 15m Candles.  
* Execute micro\_strategy.  
* **Result:** SIGNAL\_LONG, SIGNAL\_SHORT, or NONE.

**Step 3: Synthesis & Proposal**

* **Logic:** IF Macro is BULLISH AND Micro is SIGNAL\_LONG:  
  * Calculate Stop Loss & Take Profit.  
  * Check Risk/Reward Ratio.  
  * **Transition to State:** PROPOSING.  
  * **Action:** Broadcast "Ghost Lines" (Entry/SL/TP boxes) via WebSocket to Frontend.

**Step 4: Execution (Human-in-the-Loop)**

* **Wait** for User Approval (Button "GO").  
* **IF Approved:**  
  * Send Order to Exchange (Paper or Live).  
  * Link Order ID to Agent ID.

## **4\. FRONTEND: MISSION CONTROL (KlineCharts Integration)**

The UI must reflect the "Glass Box" philosophy.

### **4.1 The Fleet Dashboard (Dashboard.tsx)**

A table showing all deployed agents.

* **Columns:** Agent Name | Pair | Mode (Paper/Live) | Status | Session PnL | Kill Switch %  
* **Live Updates:** PnL must tick in real-time.

### **4.2 Agent Detail View (The Cockpit)**

When clicking an agent:

1. **Chart (KlineCharts):**  
   * Use registerOverlay to draw the agent's "Visual Snapshot" (from DB or WS).  
   * **Visuals:** Dotted lines for "Thinking Process", Solid lines for "Active Trades".  
2. **Live Terminal:**  
   * Scrolling log of agent\_logs.  
3. **Controls:**  
   * \[START\] / \[PAUSE\] / \[EMERGENCY STOP\]  
   * **Config:** Slider for "Max Drawdown %" (Kill Switch).

## **5\. IMPLEMENTATION TASKS (Prioritized)**

### **Phase 1: Backend Core (The Engine)**

* \[ \] **DB Migration:** Create trading\_agents and agent\_logs tables.  
* \[ \] **Retention Job:** Setup Celery beat or Cron for 15-day cleanup.  
* \[ \] **Agent Class:** Implement TradingAgentInstance with Multi-Timeframe fetching.

### **Phase 2: Live Trading Bridge**

* \[ \] **Exchange Connector:** Extend ccxt wrapper to support switching between Paper (Internal DB) and Live (Binance API) based on mode flag.  
* \[ \] **Security:** Ensure Live Orders verify vault\_keys decryption before sending.

### **Phase 3: Frontend "Mission Control"**

* \[ \] **Fleet Dashboard:** Create the overview table.  
* \[ \] **Visualizer:** Implement KlineCharts Overlay for visual\_snapshot JSON data.  
* \[ \] **Config UI:** Add "Kill Switch" slider to Agent Settings.

Developer Note:  
Focus on Phase 1 immediately. We need the data structure to store the "Ghost Lines" before we can visualize them.