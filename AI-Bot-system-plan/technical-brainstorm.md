# **📘 MASTER TECHNICAL DESIGN DOCUMENT (TDD)**

Project: Autarkic Trading Platform  
Version: 3.0 (KlineCharts Update)  
Date: December 8, 2025  
Scope: AI Strategy Engine, KlineCharts Visualization, and Interactive Trading Fleet

## **1\. EXECUTIVE SUMMARY & ARCHITECTURE**

We are evolving the platform into an **AI-Assisted Autonomous Trading Ecosystem**.

**Core Technology Shift (Dec 8):**

1. **Visualization:** Switched from D3.js/TradingView to **KlineCharts** (Open Source, Canvas-based).  
2. **Strategy Logic:** **Python** is the primary execution format. Pine Script serves only as an input DSL (Domain Specific Language) for the AI generator.

### **1.1 High-Level Architecture**

The system remains microservice-based (Docker).

| Service | Container | Port | Responsibility |
| :---- | :---- | :---- | :---- |
| **Frontend** | frontend | 5173 | React 19, **KlineCharts**, Mission Control UI |
| **Backend** | backend | 8000 | FastAPI, Fleet Manager, WebSocket Hub |
| **Strategy Engine** | strategy-engine | 8001 | **Isolated Python Execution Environment** |
| **AI Sentinel** | ai-sentinel | \- | LLM Gateway (Gemini 2.5) |
| **Database** | ledger-db | 5432 | TimescaleDB (Users, Strategies, Fleet Config) |

## **2\. MODULE A: THE STRATEGY FACTORY (Python First)**

**Goal:** Generate robust Python (Pandas) strategies from user intent (Pine Script or Text).

### **2.1 The "AI Transpiler" Service**

* **Location:** backend/services/ai\_transpiler.py  
* **Input:** Pine Script code OR Natural Language Description.  
* **Output:** **Executable Python Code**.  
  * *Note:* While we allow Pine Script input, the system treats the generated Python code as the "Source of Truth" for execution.  
* **Logic:**  
  1. Fetch User API Key.  
  2. Prompt Gemini: "Generate Python code using Pandas. Structure: calculate(df)."  
  3. Save result to strategies.python\_code.

### **2.2 The "Dual-Tab" Editor (Frontend)**

* **Tab 1: Concept (Pine/Text)** \- User describes logic here.  
* **Tab 2: Engine (Python)** \- **The Active Code**.  
  * The Backtester and Live Engine ONLY read from Tab 2\.  
  * Users can manually tweak the Python code here.

### **2.3 Data Model**

* **Table:** strategies  
* **New Column:** type (ENUM: STRATEGY, INDICATOR).  
* **Differentiation:**  
  * **STRATEGY:** Generates Signals (buy/sell). Can be backtested.  
  * **INDICATOR:** Generates Values (e.g., ma\_line). Visual overlay only.

## **3\. MODULE B: VISUALIZATION (KlineCharts)**

**Goal:** Professional Charting with Drawing Tools and Custom AI Overlays.

### **3.1 Technology Stack**

* **Library:** klinecharts (v9.8+).  
* **Wrapper:** KlineChartCore.tsx (React Wrapper).

### **3.2 Drawing Tools (Native)**

KlineCharts has built-in support for drawing. We do NOT need to build this from scratch.

* **Implementation:** Use chart.createOverlay(...) for user drawings.  
* **Tools:** Trendline, Fibonacci, Channels, Annotations.  
* **Persistence:** Save drawing coordinates to user\_documents or local state.

### **3.3 Custom Overlays (AI & FVG)**

To visualize **Fair Value Gaps (FVG)** and **Agent Thoughts**, we must register **Custom Overlays** in KlineCharts.

**Task for Frontend Devs:**

1. **Register Overlay:** Create a custom overlay definition for "Rectangles" (FVG) and "Ghost Lines" (Agent Proposals).  
   // Example Concept for FVG Overlay in KlineCharts  
   klinecharts.registerOverlay({  
     name: 'fvg\_box',  
     draw: (ctx, { dataList, xAxis, yAxis }) \=\> {  
       // Draw semi-transparent rectangles based on dataList  
     }  
   })

2. **Data Sync:** When the Backend sends FVG data, convert it to the overlay data format and add it to the chart.

## **4\. MODULE C: THE TRADING FLEET (Execution)**

**Goal:** Manage autonomous agents that "think" visually.

### **4.1 Fleet Architecture**

* **Workers:** TradingAgentInstance (Python Class).  
* **Concurrency:** asyncio loop running in backend.

### **4.2 The "Visual Thought" Loop**

1. **Analyze:** Agent calculates signals in Python.  
2. **Propose:** Agent identifies a setup (e.g., "Support at 95k").  
3. **Broadcast:** Agent sends a WebSocket message:  
   {  
     "agent\_id": "btc-bot-1",  
     "visuals": \[  
       { "type": "line", "price": 95000, "color": "green", "label": "Proposed Entry" }  
     \]  
   }

4. **Render:** Frontend receives message \-\> Draws a **Custom Overlay** on KlineCharts (Ghost Line).

### **4.3 Global Order Book**

* **Integration:** All Agent orders are tagged with source: "AUTO:\<AgentName\>".  
* **View:** Displayed in the unified Order Book component.

## **5\. USER INTERFACE: "MISSION CONTROL"**

### **5.1 The Bot Registry**

A table replacing the static strategy list.  
| Agent | Pair | Status | PnL | Action |  
| :--- | :--- | :--- | :--- | :--- |  
| BTC Alpha | BTC/USDT | 🟢 ACTIVE | \+$120 | \[STOP\] |  
| SOL Scalp | SOL/USDT | 🟡 PROPOSING | $0 | \[REVIEW\] |

### **5.2 The Interactive Detail View**

When clicking \[REVIEW\]:

1. **Chart (KlineCharts):** Shows the pair with **Agent Overlays** (Proposed Entry/SL/TP).  
2. **Live Log:** "Scanning... Found Pattern... Waiting for Approval."  
3. **Chat:** "Why 95k?" \-\> Agent answers using RAG context.  
4. **Controls:** \[APPROVE\] | \[REJECT\].

## **6\. IMPLEMENTATION ROADMAP (Updated)**

### **Phase 1: Foundation (Backend & DB)**

* \[ \] **1.1 DB Migration:** Add python\_code, agent\_type columns.  
* \[ \] **1.2 Transpiler:** Implement Gemini \-\> Python service.

### **Phase 2: Strategy Factory (Frontend)**

* \[ \] **2.1 Dual Editor:** Implement Split-View (Pine / Python).  
* \[ \] **2.2 Connection:** Connect "Generate" button.

### **Phase 3: Visualization (KlineCharts Adaptation)**

* \[ \] **3.1 Custom Overlays:** Implement registerOverlay for FVG (Fair Value Gaps).  
* \[ \] **3.2 Agent Overlays:** Implement "Ghost Lines" visualization on KlineCharts.  
* \[ \] **3.3 Cleanup:** Remove legacy D3.js and Lightweight Charts code.

### **Phase 4: Mission Control**

* \[ \] **4.1 Fleet Manager:** Implement TradingAgentInstance in Python.  
* \[ \] **4.2 Dashboard:** Build Bot Registry & Detail View.

Approved By: Project Lead  
Reference: technical-overview-8-dez.md (Status Quo)