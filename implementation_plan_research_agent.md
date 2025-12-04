# Implementation Plan: AI Research Agent & Document Management

**Goal:** Transform the "Analysis" tab into a comprehensive Research Dashboard featuring an AI Agent, Real-time Charting, and a Document Management System.

## 1. Architecture & Layout Overview

### A. Frontend Layout (Analysis Dashboard)
The screen will be divided into three main areas:
1.  **Right Sidebar (The Agent):**
    *   Replaces "Order Entry" in this view.
    *   **Controls:** Symbol Selector, Timeframe Selector (1m - 1d).
    *   **Quick Actions:** Buttons for "Analyze Trend" and "Summarize News".
    *   **Chat Interface:** Free text input for custom prompts.
2.  **Main Content Area (Split View):**
    *   **Top (40%):** `TradingChart` displaying the selected symbol/timeframe.
    *   **Bottom (60%):** `DocumentViewer` (Markdown) displaying the AI's output.
3.  **Left Sidebar (Navigation/Docs):**
    *   Existing Navigation.
    *   **New:** "Saved Documents" browser (Folders/Tags/Search).

### B. Backend Logic (FastAPI)
*   **Endpoint:** `/api/v1/research/analyze`
*   **Input:** `symbol`, `timeframe`, `prompt_type` (trend/news/custom), `custom_prompt`.
*   **Process:**
    1.  Fetch Real-time OHLCV data via `MarketService` (CCXT/Binance).
    2.  Calculate basic technical indicators (RSI, SMA, MACD) using `pandas-ta` (if available) or raw data.
    3.  Construct a context-rich prompt: "Here is the OHLCV data for {symbol}... {User Prompt}".
    4.  Send to Gemini API.
    5.  Return Markdown response.

### C. Document Management
*   **Data Model:** `UserDocument` (already exists, needs `folder` or `category` field).
*   **Features:** Save, Edit Title, Assign Folder/Tag, Search by Keyword.

---

## 2. Phased Implementation Steps

### Phase 1: Backend Core & Data Integration
*   [ ] **Task 1.1:** Update `MarketService` to ensure robust error handling for various timeframes.
    *   *Details:* Verify `get_ohlcv` works for '1m', '5m', '15m', '1h', '4h', '1d'.
*   [ ] **Task 1.2:** Refactor `/api/v1/research/analyze` in `research.py`.
    *   *Details:* 
        *   Initialize `MarketService`.
        *   Accept `limit` (default 100) in `AnalysisRequest`.
        *   Call `market_service.get_ohlcv(symbol, timeframe, limit)`.
        *   **Crucial:** Format the returned OHLCV data into a clear text summary for the LLM (e.g., "Last 5 candles: ...").
        *   Calculate basic indicators (RSI, SMA) using `pandas_ta` on the fetched data before sending to LLM (to give it "eyes").
*   [ ] **Task 1.3:** Update `UserDocument` model.
    *   *Details:* Add `folder` (string) and `updated_at` fields. Update Pydantic schemas.

### Phase 2: Frontend Layout & Agent Sidebar
*   [ ] **Task 2.1:** Create `ResearchLayout` component.
    *   *Details:* Implement the Split View (Chart Top / Doc Bottom).
*   [ ] **Task 2.2:** Create `ResearchAgentSidebar` component.
    *   *Details:* Implement Symbol/Timeframe selectors and Quick Action buttons.
*   [ ] **Task 2.3:** Integrate `TradingChart` into the Research Layout.
    *   *Details:* Ensure it updates based on the Sidebar's selection.

### Phase 3: Document Viewer & Management
*   [ ] **Task 3.1:** Enhance `DocumentViewer`.
    *   *Details:* Add "Save" button. Open a modal to enter Title and Folder name.
*   [ ] **Task 3.2:** Create `DocumentExplorer` component.
    *   *Details:* List saved documents, grouped by Folder. Implement Search bar.
*   [ ] **Task 3.3:** Connect "Save" and "Load" actions to Backend API.

### Phase 4: Refinement & Testing
*   [ ] **Task 4.1:** Verify "Analyze Trend" prompt quality with real data.
*   [ ] **Task 4.2:** Test "News" prompt (Note: Will rely on LLM's internal knowledge cutoff unless we add a Search Tool).
*   [ ] **Task 4.3:** UI Polish (Loading states, error handling, mobile responsiveness).

---

## 3. Questions & Clarifications
*   **News Source:** For "tagesaktuelle Nachrichten" (daily news), Gemini might be limited by its knowledge cutoff. Do we want to integrate a specific News API (e.g., CryptoPanic) later? For now, we will rely on Gemini's training.
*   **Chart Sync:** Should the Chart automatically draw lines based on the AI's analysis? (Future feature, for now just visual).
