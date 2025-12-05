# **🚀 Detailed Execution Roadmap: AI Strategy Engine**

Project: Autarkic Trading Platform  
Status: Ready for Dev  
Priority: Critical (Core Feature)  
Language: Technical English (for Devs) / Context (English) for PM

## **🛑 0\. GOLDEN RULES (Safety Protocol)**

**To all Developers:**

1. **No Regressions:** Login, Paper-Trading, and existing charts must not be touched or broken.  
2. **Additive Development:** New features go into new files or new columns. Existing code is imported, not rewritten.  
3. **Isolation:** The strategy-engine container is the only place where generated code is executed. Never use exec() in the main backend\!

## **🗓️ PHASE 1: The Foundation (Backend & Database)**

Goal: Prepare the database and establish the AI connection.  
Responsible: Backend Lead

### **1.1 Database Extension (Hard Requirement)**

We must store what the AI generates.

* **File:** backend/alembic/versions/xxxx\_add\_strategy\_ai\_fields.py  
* **Task:** Create migration for the strategies table:  
  * python\_code (TEXT, nullable): The generated code.  
  * type (VARCHAR/ENUM): Values STRATEGY (default) or INDICATOR.  
  * compiled\_at (TIMESTAMP): To track if the code is up-to-date.  
* **Definition of Done:** Migration runs without errors; table has new columns; rollback is possible.

### **1.2 The "AI Transpiler" Service**

The core service that converts Text (Pine) into Code (Python).

* **File:** backend/app/services/ai\_transpiler.py  
* **Input:** User-ID (for API Key lookup), Pine Script String.  
* **Logic:**  
  1. Retrieve User API Key from DB (Table user\_api\_keys).  
  2. Send prompt to Gemini Flash 2.0.  
  3. **IMPORTANT:** Filter Markdown (\`\`\`python) out of the response.  
* **Output:** Pure Python string.  
* **Error Handling:** If API Key missing \-\> 400 Missing API Key. If AI fails \-\> 502 Bad Gateway.

### **1.3 API Interface (The Contract)**

* **Endpoint:** POST /api/v1/strategies/transpile  
* **Request Body:** {"pine\_script": "..."}  
* **Response:** {"python\_code": "def calculate(df): ...", "status": "success"}  
* **Definition of Done:** You can send a Pine Script snippet via Postman and receive clean Python code back.

## **🗓️ PHASE 2: The Frontend (Dual-Editor)**

Goal: The user sees Pine Script and Python side-by-side, without copy-paste.  
Responsible: Frontend Dev

### **2.1 UI Refactor "Split View"**

* **Location:** frontend/src/features/strategies/components/PineScriptPanel.tsx  
* **Task:**  
  * Add Tabs: \[ Pine Script (Source) \] | \[ Python Engine (Generated) \].  
  * The Python tab is **read-only** until the user explicitly clicks "Unlock" (Security Feature).  
* **State Management:**  
  * New React State: pythonCode.  
  * When loading a strategy, check: Is python\_code in the DB? If yes, load it into Tab 2\.

### **2.2 The "Generate" Button & Workflow**

* **Task:** Button "⚡ Generate Engine" next to "Save".  
* **Flow:**  
  1. User clicks Button.  
  2. UI shows Spinner/Loading.  
  3. Request to POST /transpile.  
  4. **On Success:**  
     * Automatically switch to tab "Python Engine".  
     * Fill editor with result.  
     * Show Toast "Conversion successful".  
* **Definition of Done:** Clicking the button generates code, tab switches automatically, code is visible.

## **🗓️ PHASE 3: The Execution (Core Operation)**

Goal: Safely execute and test the generated code.  
Responsible: Backend Senior & DevOps

### **3.1 Strategy Engine "Sandbox"**

* **Container:** strategy-engine (Port 8001\)  
* **Task:** Endpoint POST /execute  
* **Security Wrapper:**  
  * Use try/except blocks around exec().  
  * Set a **Timeout** (e.g., 3 seconds). If code runs longer \-\> Kill Process.  
  * Allow imports only for pandas, numpy. Prevent os, sys (Security Risk\!).

### **3.2 The Connection (Proxy)**

The Frontend never talks directly to the Strategy Engine, always via the Backend.

* **Flow:**  
  1. Frontend: POST /api/v1/backtest/run (Payload: python\_code, symbol, timeframe).  
  2. Backend: Loads OHLCV Data from Market Service.  
  3. Backend: Sends Data \+ Code to strategy-engine.  
  4. Strategy-Engine: Executes, calculates signals.  
  5. Backend: Receives signals, calculates PnL (Profit/Loss).  
  6. Frontend: Displays curve.

### **3.3 Backtest UI Update**

* **IMPORTANT:** When the user clicks "Run Backtest", the Pine Script must **NOT** be used anymore.  
* **Logic:** Always send the content of the **Python Tab**. If empty \-\> Error "Please generate engine first".

## **🗓️ PHASE 4: Indicators vs. Strategies**

Goal: UI logic to avoid confusion.  
Responsible: Frontend Dev

### **4.1 Type-Switch on Save**

* **UI:** In "Save Strategy" Modal: Radio Buttons (o) Strategy (Trades) vs ( ) Indicator (Displays only).  
* **Logic:** Store selection in field type.

### **4.2 UI Consequences**

* If type \== INDICATOR:  
  * Disable the "Run Backtest" Button (Grayed out).  
  * Show Tooltip: "Indicators cannot be backtested alone. Use 'Strategy Composer' to trade."  
* **Definition of Done:** A script saved as an indicator cannot be backtested but is shown in the list with an "IND" badge.

## **🗓️ PHASE 5: Visualization (D3.js Charts)**

Goal: Draw Fair Value Gaps (FVG) and Trendlines.  
Responsible: Frontend D3 Expert

### **5.1 FVG Rendering (Rectangles)**

* **File:** frontend/src/components/charts/D3Chart.tsx  
* **Data Input:** overlays.shapes Array (from Backend).  
* **Task:** Draw rect SVG elements.  
  * x: Time Scale (Mapping Time \-\> Pixel).  
  * y: Price Scale (Mapping Price \-\> Pixel).  
  * width: EndTime \- StartTime.  
  * height: TopPrice \- BottomPrice.  
  * opacity: 0.2 (Semi-transparent).

### **5.2 Trendline Tool (Interaction)**

* **UI:** Toolbar Button "Draw Line".  
* **Event Handling:**  
  * onMouseDown: Set Start Point (x1, y1).  
  * onMouseMove: Draw temporary line to cursor.  
  * onMouseUp: Set End Point (x2, y2).  
* **Math:** Convert pixel coordinates back to Price/Time and store them in State.

## **🗓️ PHASE 6: The Composer (Optional / Bonus)**

**Goal:** Connect two indicators via AI.

* **Endpoint:** POST /api/v1/strategies/compose  
* **Payload:** indicator\_a\_id, indicator\_b\_id, logic\_prompt ("Buy when A crosses B").  
* **Backend Logic:**  
  1. Load Python Code of A and B from DB.  
  2. Build AI Prompt: "Here is Code A, here is Code B. Combine them based on this rule:$$User Prompt$$  
     . Return valid Python Code."  
  3. Send result to Frontend.

## **✅ WEEKLY COMPLETION CHECKLIST**

| Feature | Acceptance Criteria (Definition of Done) |
| :---- | :---- |
| **DB & Backend** | Migration applied, API /transpile responds with Python Code. |
| **Frontend Editor** | Tabs are present. "Generate" fills the Python Tab. Code is saved. |
| **Backtest** | "Run Backtest" uses the Python Code and returns PnL results. |
| **Security** | Backend does not crash if invalid code is sent (Timeout/Error Catching). |
| **Charts** | An FVG rectangle is visible on the chart (even with Mock Data). |

Instruction to Lead Developer:  
Distribute Phases 1, 2, and 5 in parallel to Backend, Frontend, and Chart Devs.  
Start Phase 3 (Execution) only once Phases 1 & 2 are stable.