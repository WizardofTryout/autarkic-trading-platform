# Projektstatus & Architektur-Übersicht

Dieses Dokument fasst den aktuellen Stand der Entwicklung, die Docker-Infrastruktur, den Technologie-Stack und die bereits implementierten Funktionen zusammen. Es dient als Grundlage für die weitere Planung mit dem Entwicklungsteam.

## 1. Infrastruktur & Docker-Architektur

Das System ist als Microservices-Architektur konzipiert und wird vollständig über Docker Compose orchestriert.

### Services & Container

| Service | Container Name | Image / Build | Port (Host) | Netzwerk | Beschreibung |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `frontend` | `./frontend` | `5173` | `public_net` | React Web-Applikation (Vite). Zugriff über `http://localhost:5173`. |
| **Backend** | `backend` | `./backend` | `8000` | `public_net`, `app_net`, `data_net` | Haupt-API (FastAPI). Zugriff über `http://localhost:8000`. |
| **Strategy Engine** | `strategy-engine` | `./strategy-engine` | `8001` | `app_net`, `data_net` | Ausführung von Handelsstrategien & Transpiler. |
| **AI Sentinel** | `ai-sentinel` | `./ai-sentinel` | - | `app_net` | Interner KI-Überwachungsdienst (kein direkter externer Zugriff). |
| **Ledger DB** | `ledger-db` | `timescale/timescaledb:latest-pg15` | - | `data_net` | TimescaleDB (PostgreSQL) für Zeitreihendaten & Persistenz. |
| **Redis** | `redis` | `redis:alpine` | - | `data_net`, `app_net` | Caching & Messaging Broker zwischen den Services. |

### Netzwerke

- **`public_net`**: Ermöglicht den Zugriff von außen (Host) auf Frontend und Backend.
- **`app_net`**: Internes Applikationsnetzwerk für die Kommunikation zwischen Backend, Strategy Engine, AI Sentinel und Redis.
- **`data_net`**: Isoliertes Datennetzwerk für Datenbank- und Cache-Zugriffe.

---

## 2. Technologie-Stack

### Backend (`/backend`)
- **Sprache:** Python 3.11
- **Framework:** FastAPI (High-Performance Async API)
- **Server:** Uvicorn
- **Datenbank-ORM:** SQLAlchemy (Async) + Alembic (Migrationen)
- **Validierung:** Pydantic v2
- **Trading:** CCXT (Crypto Exchange Support)
- **Datenanalyse:** Pandas, Numpy
- **Sicherheit:** Cryptography, Argon2 (Hashing)

### Frontend (`/frontend`)
- **Sprache:** TypeScript
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** TailwindCSS v4
- **State Management:** Zustand
- **Charting:** Lightweight Charts (TradingView)
- **Icons:** Lucide React

### Strategy Engine (`/strategy-engine`)
- **Sprache:** Python
- **Kernfunktion:** Transpiler (POC) zur Umwandlung von Pine Script (TradingView) Logik in Python (`pandas_ta`).

### AI Sentinel (`/ai-sentinel`)
- **Sprache:** Python
- **Status:** Basis-Gerüst vorhanden.

---

## 3. Implementierte Funktionen & Status

### Backend API
Die API ist unter `http://localhost:8000/docs` (Swagger UI) dokumentiert, sobald der Container läuft.

- **Authentifizierung (`/api/v1/auth`)**:
  - Login/Logout Logik implementiert.
  - Token-basierte Sicherheit.
- **Marktdaten (`/api/v1/market`)**:
  - Abruf von Marktdaten (Struktur vorhanden).
- **Trading (`/api/v1/trade`)**:
  - Order-Platzierung und -Verwaltung.

### Frontend Features
Die Web-App ist unter `http://localhost:5173` erreichbar.

- **Order Entry**:
  - Komponente zur Eingabe von Trades (`OrderEntry.tsx`).
  - Unterstützt Kauf/Verkauf Logik.
- **Charting**:
  - Integration von TradingView Lightweight Charts (`Chart/`).
  - Darstellung von Kerzencharts (Candlesticks).
- **Approval Workflow**:
  - Modal-Dialog für Bestätigungen (`ApprovalModal.tsx`).
  - Sicherheitsmechanismus vor kritischen Aktionen.

### Strategy Engine Features
- **Pine Script Transpiler (POC)**:
  - Kann einfache Pine Script Indikatoren parsen (`parser.py`).
  - Generiert daraus ausführbaren Python-Code (`generator.py`).
  - Unterstützte Indikatoren bisher: `RSI`, `EMA`, `SMA`.

---

## 4. Nächste Schritte für Entwickler

Um die Entwicklung fortzusetzen, sollten folgende Punkte beachtet werden:

1.  **Environment Setup**: Sicherstellen, dass die `.env` Datei im `infra` Ordner korrekt konfiguriert ist (insb. DB-Passwörter).
2.  **Datenbank-Migrationen**: `alembic upgrade head` im Backend-Container ausführen, um das DB-Schema zu initialisieren.
3.  **Strategy Engine Erweiterung**: Der Transpiler ist ein Proof-of-Concept. Weitere Indikatoren und Logik-Konstrukte müssen implementiert werden.
4.  **AI Integration**: Der `ai-sentinel` Service ist bisher nur ein Rumpf und muss mit Leben gefüllt werden.

---

## 5. Fehlende Funktionen & Roadmap

Aktuell ist das System ein technischer Prototyp. Für eine produktive Nutzung durch Endanwender fehlen essenzielle Komponenten:

### Benutzerführung & UX
- **Onboarding**: Keine Einführung oder geführte Tour durch die Applikation.
- **Fehlermeldungen**: Keine benutzerfreundliche Darstellung von Fehlern (z.B. bei fehlgeschlagenen Trades).
- **Dashboard**: Kein personalisierbares Dashboard für den schnellen Überblick.

### Trading & Analyse
- **Pine Script Upload**: Keine Benutzeroberfläche zum Hochladen, Verwalten oder Editieren von Pine Scripts.
- **Chart-Tools**: Keine Zeichenwerkzeuge (Trendlinien, Fibonacci, etc.) im Chart verfügbar.
- **Indikatoren-Auswahl**: Keine GUI zur Auswahl und Konfiguration von Indikatoren im Chart.

### Konfiguration & Sicherheit
- **API-Key Management**: Keine Möglichkeit für Benutzer, ihre eigenen Börsen-API-Keys sicher zu hinterlegen.
- **Exchange-Auswahl**: Keine Auswahlmöglichkeit der Handelsbörse im Frontend.

### Zusammenfassung
Das System bietet ein solides technisches Fundament (Backend, Docker, DB), ist aber aus Nutzersicht ("Human-in-the-Loop") noch nicht verwendbar. Der Fokus lag bisher rein auf der Infrastruktur und der algorithmischen Ausführbarkeit.

---

## 6. Migrations-Roadmap (Legacy Merge)

Um die fehlenden Funktionen zu ergänzen und das "TradingView"-Logo zu entfernen, werden wir die Komponenten aus der Legacy App (August 2025) migrieren.

### Phase 1: Vorbereitung & Dependencies
- [x] **Checkpoint 1.1**: `d3` und `@types/d3` im `frontend` installieren.
- [x] **Checkpoint 1.2**: Hilfsfunktionen (`technicalIndicators.ts`) aus der Legacy App kopieren.

### Phase 2: Settings & API Keys
- [x] **Checkpoint 2.1**: `SettingsPage.tsx` kopieren und an Tailwind v4 anpassen.
- [x] **Checkpoint 2.2**: API-Service (`api.ts`) um Methoden zum Speichern/Laden von Settings erweitern.
- [x] **Checkpoint 2.3**: Backend-Endpunkt (`/api/v1/settings`) für sichere Speicherung implementieren.
- [ ] **Tick Charts**: Implement tick-based candles (1 tick, 10 ticks, etc.) with client-side aggregation.
- [ ] **Advanced Order Types**: Stop Market, Stop Limit, Trailing Stop.
- [x] **Checkpoint 2.4**: Routing im Frontend anpassen (`App.tsx`), um die Settings-Seite erreichbar zu machen.

### Phase 3: Pine Script Editor
- [x] **Checkpoint 3.1**: `PineScriptPanel.tsx` und `pine-script-engine/` kopieren.
- [x] **Checkpoint 3.2**: Editor-Komponente in das Layout integrieren (z.B. als neuer Tab oder Modal).
- [x] **Checkpoint 3.3**: "Save & Compile" Button mit dem Backend-Transpiler verbinden.

### Phase 4: Charting Migration (Logo Removal)
- [x] **Checkpoint 4.1**: `AdvancedFinancialChart.tsx` (D3-basiert) als `D3Chart.tsx` in das Projekt kopieren.
- [x] **Checkpoint 4.2**: `TradingChart.tsx` (Lightweight Charts) durch `D3Chart.tsx` ersetzen oder als Option anbieten.
- [x] **Checkpoint 4.3**: Sicherstellen, dass Marktdaten korrekt in das D3-Format konvertiert werden.
- [x] **Checkpoint 4.4**: Verifikation der Indikatoren und Zeichenwerkzeuge.

### Phase 5: Trading Engine & Execution (Current Focus)
- [x] **Checkpoint 5.1**: Backend-Endpunkt (`/execute`) für Pine Script Ausführung implementieren.
- [x] **Checkpoint 5.2**: `D3Chart.tsx` mit Execution-API verbinden.
- [x] **Checkpoint 5.3**: Visualisierung von Kauf-/Verkaufssignalen im Chart.
- [x] **Checkpoint 5.4**: Anbindung echter Marktdaten (Binance WebSocket für Ticker & Klines).
- [x] **Checkpoint 5.5**: Implementierung von Timeframe-Auswahl (1m, 5m, 15m, 30m, 1h, 4h, 1d) mit dynamischer Achsen-Formatierung.
- [x] **Checkpoint 5.6**: UI Polish (Chart Scaling, Right Axis, Price Relocation, Indicator Matrix).
- [x] **Checkpoint 5.7**: Git Workflow Dokumentation & Automatisierung.

### Phase 6: User Management & Integration [x]
    - [x] Backend: User Model & Auth Endpoints
    - [x] Frontend: Login & Register Pages
    - [x] **User Profile & Settings**
        - [x] UI: User Profile Page (Manage Account)
        - [x] UI: Logout Button in Header
        - [x] Feature: Change Password
        - [x] Feature: Password Reset Flow (Forgot Password)
    - [x] **Strategy Management**
        - [x] Backend: Link Strategies to Users (Ownership)
        - [x] Backend: Strategy Categories & Favorites
        - [x] Frontend: My Strategies Dashboard
        - [x] Frontend: Upload/Edit Pine Scripts as User
        - [x] **Checkpoint 6.3**: Speicherung von User-spezifischen Strategien und Settings in der DB.

---

### 7. Strategie für Live Trading Engine (Paper Trading First)
Wir verfolgen einen **"Paper Trading First"** Ansatz. Das Ziel ist es, die Engine so weit zu entwickeln, dass sie mit echten Marktdaten arbeitet, aber Trades zunächst nur simuliert ("Trockenübung").

*   **Stufe A: Echte Daten (Realtime Data)**
    *   Der `/execute` Endpunkt und die Engine nutzen echte historische Daten und Live-Daten (via WebSocket/CCXT) anstelle von Mock-Daten.
    *   Ziel: Signale basieren auf der Realität.

*   **Stufe B: Paper Execution (Simulation)**
    *   Die Engine führt die Logik aus (Kauf/Verkauf), sendet aber **keine** echte Order an die Börse.
    *   Stattdessen wird der Trade in der Datenbank protokolliert, als ob er stattgefunden hätte.
    *   Dies ermöglicht umfangreiche Testläufe ohne finanzielles Risiko.

*   **Stufe C: Der "Kill Switch" (Real Money)**
    *   Implementierung eines globalen Schalters (konfigurierbar in Settings).
    *   Nur wenn dieser aktiviert ist UND gültige API-Keys vorliegen, werden Orders tatsächlich an Binance/Bitget gesendet.
    *   Technisch ist dies nur ein kleiner Schritt von Stufe B ("If RealMoney: ccxt.create_order() else: log_trade()").

## 8. Neue Anforderungen & Erweiterungen (Next Steps)

Basierend auf dem aktuellen Feedback werden folgende Erweiterungen priorisiert:

### 8.1 UI Professionalisierung & Charting
*   **Symbol-Auswahl**: Dropdown/Suche zur Auswahl verschiedener Handelspaare (z.B. BTC/USDT, ETH/USDT) für den Chart.
*   **Technische Analyse Tools**:
    *   Integration von Zeichenwerkzeugen (Trendlinien, Support/Resistance).
    *   Detaillierte Mouse-Over Informationen (OHLC, Indikator-Werte) im Fadenkreuz.
*   **Pine Script Editor Integration**: Vollständige UI-Integration des Editors unterhalb des Charts.

### 8.2 AI Assistant Integration
Ein intelligenter Assistent, der den User direkt in der Plattform unterstützt (nutzt den hinterlegten AI API Key):
*   **Coding Assistant**: Hilft beim Erstellen, Debuggen und Optimieren von Pine Scripts.
*   **Research Agent**: Kann auf Knopfdruck aktuelle News und Sentiment-Analysen zum angezeigten Handelspaar durchführen.
*   **Kontext-Aware**: Der Assistent "kennt" den aktuellen Chart und das offene Skript.

---

## 9. Technische Spezifikation: Pine Script Transpiler & Management
(Bisheriger Inhalt von Punkt 7...)

Die Integration von Pine Script erfolgt nicht direkt, sondern über eine Transpiler-Pipeline, um digitale Souveränität zu gewährleisten und Abhängigkeiten von TradingView-Servern zu vermeiden.

### 7.1 Script Management System
Da wir Open Source Pine Scripts verwenden, benötigen wir ein Verwaltungssystem:
-   **Script Library**: Datenbank-gestützte Verwaltung von Scripts.
-   **Favoriten**: Möglichkeit für Benutzer, Scripts zu favorisieren.
-   **Kombination**: UI zum Kombinieren mehrerer Indikatoren in eine Strategie.
-   **Zugriffsrechte**: Verwaltung von privaten vs. öffentlichen Scripts.

### 7.2 Die Transpiler-Pipeline (Native Execution)
Die Umwandlung von Pine Script-Logik in ausführbaren Python-Code erfolgt in mehreren Phasen:

1.  **Parsing (Analyse)**:
    -   Einsatz von Tools wie **PyneCore** oder Eigenentwicklung auf AST-Basis.
    -   Zerlegung des PineScript-Codes in einen Abstrakten Syntaxbaum (AST).

2.  **Mapping (Abbildung)**:
    -   Abbildung von Pine-Funktionen (z.B. `ta.rsi()`, `ta.sma()`) auf Python-Äquivalente.
    -   Zielbibliotheken: **Pandas TA** oder **TA-Lib**.

3.  **Ausführung (Execution)**:
    -   Der Code läuft isoliert im **`trade-core`** (Strategy Engine) Container.
    -   Nutzung von Pandas DataFrames für "Series processing".
    -   Beispiel: `ta.rsi(close, 14)` -> `df.ta.rsi(length=14)`.

### 7.3 Datenkonsistenz (WYSIWT)
Um das Prinzip "What You See Is What You Trade" zu gewährleisten:
-   **Backend-First**: Das Backend berechnet alle Indikator-Werte für jede Kerze.
-   **Frontend-Visualisierung**: Das Frontend zeichnet **nur** die vom Backend gelieferten Werte. Es führt keine eigenen Berechnungen durch.
-   Dies garantiert, dass die visuelle Darstellung im Chart zu 100% mit den Entscheidungsgrundlagen des Algorithmus übereinstimmt.

### 7.4 Indicator Matrix UI (Benutzeroberfläche)
Basierend auf den Anforderungen (siehe Mockups) wird eine zentrale **Indikatoren-Verwaltung** ("Matrix") implementiert:

*   **Layout**: Modal-Dialog oder Sidebar-Panel ähnlich TradingView.
*   **Kategorien**:
    *   *Favorites*: Schnellzugriff auf oft genutzte Scripts.
    *   *My Scripts*: Eigene, hochgeladene oder erstellte Pine Scripts.
    *   *Built-ins*: Standard-Indikatoren (RSI, MACD, etc.) aus der Python-Library.
    *   *Community*: Zugriff auf öffentliche Scripts (optional).
*   **Funktionen**:
    *   **Suche**: Volltextsuche über alle Indikatoren.
    *   **Source Code View**: Button `{}` zum Anzeigen des Pine Script Codes.
    *   **Management**: Löschen, Umbenennen und Favorisieren von Scripts.
    *   **Add to Chart**: Hinzufügen des Indikators zum aktiven Chart (löst Backend-Berechnung aus).

### 7.5 Pine Script Editor Integration (UI Layout)
Wie im Screenshot dargestellt, wird der Editor als **integriertes Bottom-Panel** unterhalb des Charts realisiert:

*   **Position**: Collapsible Panel am unteren Bildschirmrand (ähnlich TradingView "Pine Editor" Tab).
*   **Funktionen**:
    *   **Code-Editor**: Syntax-Highlighting für Pine Script.
    *   **Update on Chart**: Button, um Änderungen sofort im darüberliegenden Chart zu visualisieren (via Backend-Transpiler).
    *   **Publish Indicator**: Speichern der Strategie für den AI-Bot.
    *   **Console/Logs**: Anzeige von Transpiler-Fehlern oder Debug-Ausgaben.
*   **Workflow**: Der Nutzer schreibt Code -> Klickt "Update" -> Backend transpiliert & berechnet -> Chart aktualisiert sich -> Nutzer validiert -> "Publish" für AI-Nutzung.
