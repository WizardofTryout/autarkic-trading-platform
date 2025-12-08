# **Technical Specification: Interactive AI Trading Supervisor (v2.0)**

Project: Autarkic Trading Platform  
Module: AI Execution Engine & Fleet Management  
Priority: Critical  
Philosophy: "Glass Box" \- Total Transparency, Multi-Pair, Human Control

## **1\. Executive Summary**

We are building an **Interactive Trading Supervisor System**. Unlike standard bots, this system manages a **fleet of autonomous agents**. Each agent monitors a specific trading pair (e.g., BTC/USDT) but reports to a central "Mission Control" dashboard.

**Key Features:**

1. **Multi-Pair Fleet:** Run multiple agents in parallel (e.g., one for BTC, one for SOL).  
2. **Visual Thinking:** Agents draw trendlines and proposals on the chart before trading.  
3. **Human-in-the-Loop:** "Propose \-\> Approve \-\> Execute" workflow.  
4. **Central Bot Order Book:** A unified table showing all active agents and their live positions.  
5. **Profit Skimming:** Automated transfer of profits to a safety reserve.

## **2\. Architecture: The Fleet Model**

### **2.1 The "Agent Instance" Concept**

We do not have "one big AI". Instead, we instantiate **Trading Workers**.

* **Class:** TradingAgentInstance  
* **Properties:** id, pair (e.g., BTC/USDT), strategy\_config, budget, state.  
* **Concurrency:** Uses Python asyncio.gather to run the analysis loop for 10+ pairs simultaneously without blocking.

### **2.2 Global Order Book Integration**

When an agent places an order, it tags the order with its agent\_id.

* **Global Order Book:** Shows ALL orders (Manual \+ Bot).  
* **Source Column:** New column source in the order table (MANUAL vs AUTO: {AgentName}).

## **3\. Functional Requirements**

### **3.1 The State Machine (Per Agent)**

Each Agent (e.g., the "SOL Scalper") follows its own lifecycle:

1. **SCANNING**: Checking multiple timeframes for setup.  
2. **PROPOSING**: Found setup\! Draws lines on chart. **(System pauses here\!)**  
3. **AWAITING\_APPROVAL**: Pushes notification to UI.  
4. **ACTIVE**: User clicked "GO". Hunting trigger.  
5. **IN\_POSITION**: Managing open trade.  
6. **COOLDOWN**: Post-trade pause.

### **3.2 Real-Time Visualization (The "Thought Bubble")**

Each agent broadcasts via WebSocket channel: ws://api/v1/fleet/stream

{  
  "agent\_id": "agent-btc-01",  
  "symbol": "BTC/USDT",  
  "status": "PROPOSING",  
  "log": "EMA Cross detected. Proposing Long.",  
  "visuals": \[ ...Trendlines, Boxes... \]  
}

## **4\. Frontend: Mission Control (The UI)**

### **4.1 The "Bot Registry" (Order Book Overview)**

A main dashboard table replacing the standard "Active Strategies" list.

| Agent Name | Pair | Status | Current PnL | Active Position | Action |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **BTC Trend King** | BTC/USDT | 🟢 IN\_POSITION | \+$124.50 | LONG 0.5 BTC | \[STOP\] \[VIEW\] |
| **SOL Sniper** | SOL/USDT | 🟡 PROPOSING | 0.00 | \-- | \[REVIEW\] |
| **ETH Swing** | ETH/USDT | ⚪ SCANNING | \-$12.00 | \-- | \[PAUSE\] |

* **Row Click:** Opens the specific Chart for this agent with its visual overlays.

### **4.2 Interactive Detail View (The Cockpit)**

When clicking an Agent in the registry:

1. **Chart:** Shows ONLY this agent's pair and its drawn lines.  
2. **Live Log Terminal:** "Scanning 15m... RSI is 45... No signal."  
3. **Chat Interface:** "Why are you waiting?" \-\> Agent: "RSI is neutral, waiting for dip to 95k."

## **5\. Backend Task List**

### **5.1 Database: trading\_agents**

Extend table to support multi-instance fleet management.

CREATE TABLE trading\_agents (  
    id UUID PRIMARY KEY,  
    user\_id UUID,  
    name VARCHAR(50),  
    symbol VARCHAR(20),       \-- e.g. 'BTC/USDT'  
    strategy\_logic JSONB,     \-- Snapshot of the logic used  
    status VARCHAR(20),       \-- SCANNING, IN\_POSITION, etc.  
    current\_pnl DECIMAL,      \-- Session PnL  
    total\_budget DECIMAL,  
    active\_order\_id UUID      \-- Link to global order book  
);

### **5.2 Python: AgentFleetManager**

* A Service that starts/stops TradingAgentInstance loops.  
* Handles the WebSocket broadcasting (merging streams from 10 agents into one frontend feed).

## **6\. User Workflow (Multi-Pair Scenario)**

1. **Fleet Setup:**  
   * User clicks "Deploy New Agent".  
   * Configures Agent A: "BTC/USDT", Strategy "Trend Follow", Budget $1000.  
   * Configures Agent B: "SOL/USDT", Strategy "Breakout", Budget $500.  
2. **Monitoring:**  
   * User watches the **Bot Registry**.  
   * Agent A shows status SCANNING.  
   * Agent B switches to PROPOSING.  
3. **Intervention:**  
   * User clicks "Review" on Agent B.  
   * Chart opens showing SOL/USDT with a plotted "Breakout Box".  
   * User chats: "Is volume high enough?" \-\> Agent confirms.  
   * User clicks **"APPROVE"**.  
4. **Execution:**  
   * Agent B enters the trade.  
   * The **Global Order Book** shows a new Buy Order for SOL (Source: AUTO: SOL Sniper).  
   * Bot Registry shows Agent B PnL ticking.

Last Updated: 2025-12-08  
Version: 2.0 (Multi-Pair Fleet Support)