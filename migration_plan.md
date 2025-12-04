# Migrationsplan: Legacy App (August 2025) -> Trading Agent (Dezember 2025)

Dieser Plan beschreibt die Schritte zur Integration der Frontend-Funktionalitäten aus der "Legacy App" (August 2025) in die aktuelle "Trading Agent" Plattform.

## 1. Analyse-Ergebnisse

Nach Analyse des Quellcodes (`/Volumes/Spacestation/ai-trading-app-August2025/AI-Trading-App-Aug08`) wurden folgende Details festgestellt:

### A. Charting Engine (`AdvancedFinancialChart.tsx`)
-   **Technologie**: Custom **D3.js** Implementierung (kein Wrapper wie `react-financial-charts` genutzt, obwohl installiert).
-   **Features**:
    -   Candlestick Rendering via SVG.
    -   Integrierte Indikatoren: RSI, Bollinger Bands, MACD, SMA.
    -   Trading Signale Visualisierung.
    -   Zeichen-Logik Ansätze (Trendlinien, Fibonacci) im State vorhanden.
-   **Bewertung**: Sehr flexibel, aber wartungsintensiver als `lightweight-charts`. Bietet jedoch "Out-of-the-Box" Visualisierungen für Signale, die wir übernehmen sollten.

### B. Pine Script Editor (`PineScriptPanel.tsx` & `pine-script-engine/`)
-   **UI**: Editor mit Syntax-Highlighting Ansätzen.
-   **Logik**: Eigener `interpreter.ts` und `parser.ts` im Frontend.
- [x] **Tick Charts**: Implement tick-based candles (1 tick, 10 ticks, etc.) with client-side aggregation.
- [x] **Advanced Order Types**: Stop Market, Stop Limit, Trailing Stop.
-   **Integration**: Speichert Strategien via API.

### C. Settings & API Keys (`SettingsPage.tsx`)
-   **Features**: Formulare für Bitget, Binance, AI-Keys und Risikomanagement-Parameter (StopLoss, Leverage).
-   **State**: Lädt/Speichert via `/settings` Endpunkt.

## 2. Integrations-Strategie

Wir werden die Komponenten in das neue `frontend` (Vite + React + Tailwind v4) migrieren.

### Phase 1: Dependencies & Setup
1.  **Installieren**: `npm install d3 @types/d3` im aktuellen `frontend`.
2.  **Kopieren**:
    -   `app/src/utils/technicalIndicators.ts` -> `frontend/src/utils/technicalIndicators.ts`
    -   `app/src/pine-script-engine/` -> `frontend/src/pine-script-engine/`

### Phase 2: Komponenten-Migration

#### A. Settings Page (Priorität: Hoch)
-   **Datei**: `app/src/components/SettingsPage.tsx` -> `frontend/src/components/SettingsPage.tsx`
-   **Anpassung**: Styling auf Tailwind v4 aktualisieren. API-Calls auf den neuen `api_v1` Client umstellen.

#### B. Pine Script Editor (Priorität: Mittel)
-   **Datei**: `app/src/components/PineScriptPanel.tsx` -> `frontend/src/components/PineScriptPanel.tsx`
-   **Backend-Verbindung**: Statt dem lokalen Interpreter soll der Editor (optional) den Backend-Transpiler (`/api/v1/strategy/compile`) ansprechen können, oder wir portieren den lokalen Interpreter als "Preview".
-   **Empfehlung**: Wir portieren den Editor und nutzen vorerst die Backend-Validierung.

#### C. Charting (Priorität: Mittel)
-   **Strategie**: Wir behalten `lightweight-charts` als Standard (Performance), bieten aber `AdvancedFinancialChart` als "Pro View" oder "Analyse View" an.
-   **Migration**:
    -   Portierung von `AdvancedFinancialChart.tsx` nach `frontend/src/components/Chart/D3Chart.tsx`.
    -   Anpassung der D3-Skalierung an den Container.
    -   Verbindung mit dem `useStore` für Marktdaten.

### Phase 3: Backend Anpassungen
-   **Settings API**: Implementierung eines `/api/v1/settings` Endpunkts im Backend (FastAPI), um die Keys sicher zu speichern (in `secrets/` oder DB).
-   **Strategy API**: CRUD-Endpunkte für Strategien erweitern.

## 3. Schritt-für-Schritt Plan

1.  **Settings Page**: Erstellen und Routing einrichten.
2.  **API Client**: `frontend/src/services/api.ts` erweitern um Settings-Methoden.
3.  **Pine Script Editor**: Komponente kopieren und in Navigation einbinden.
4.  **D3 Chart**: Als alternative Komponente integrieren und testen.

## 4. Verifikation

-   **Settings**: Speichern von Keys -> Neustart Backend -> Keys sind noch da.
-   **Editor**: Code schreiben -> Speichern -> Taucht in Liste auf.
-   **Chart**: Vergleich D3 Chart vs. Lightweight Chart mit gleichen Daten.
