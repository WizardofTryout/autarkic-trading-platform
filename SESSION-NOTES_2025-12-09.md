# Session Notes - 9. Dezember 2025

## 🎯 Mission: Agent Cockpit - Chart & Ghost Lines Integration

### Aktueller Stand (What We Have)

✅ **Backend:**
- TradingAgentInstance läuft als Background-Task
- AgentFleetManager mit Fleet-Übersicht
- DB-Session-Problem behoben (keine "transaction closed" Fehler mehr)
- Agent kann START/PAUSE/STOP ohne Fehler

✅ **Frontend - Fleet Overview:**
- Trading Fleet Übersicht zeigt alle Agents
- Status-Updates über WebSocket
- Deploy Agent Modal funktioniert
- Agent kann gestartet werden → wechselt zu SCANNING

✅ **Frontend - Agent Cockpit (teilweise):**
- Detail-View öffnet sich beim Klick auf "View Agent" (Augen-Icon)
- Rechte Sidebar zeigt:
  - Session Stats (Budget, P&L, Trades, Win Rate, Kill Switch, Risk/Trade)
  - Agent Log (scrollbarer Terminal mit Status-Updates)
- Start/Stop-Buttons in der Header-Leiste

---

### ❌ Was FEHLT (The Problem)

**Agent Cockpit - Left Side:**
- **KEIN Chart** wird angezeigt
- Nur Platzhalter: "📊 KlineCharts Integration"
- **KEINE Ghost Lines** (die visualisierten Trade-Proposals des Agents)

**Laut Plan (Interactive AI Trading Supervisor v2.0):**

> **4.2 Interactive Detail View (The Cockpit)**
> 
> When clicking an Agent in the registry:
> 1. **Chart:** Shows ONLY this agent's pair and its drawn lines.
> 2. **Live Log Terminal:** "Scanning 15m... RSI is 45... No signal."
> 3. **Chat Interface:** "Why are you waiting?" → Agent: "RSI is neutral, waiting for dip to 95k."

**Was der Agent machen sollte:**

1. **SCANNING** → Agent analysiert Markt
2. **PROPOSING** → Agent findet Setup, zeichnet "Ghost Lines" auf Chart:
   - Entry-Linie (wo Agent einsteigen will)
   - Stop-Loss-Linie (rote Linie)
   - Take-Profit-Linie (grüne Linie)
   - Optional: Trendlines, Fibonacci, Support/Resistance
3. **AWAITING_APPROVAL** → System pausiert, User sieht Proposal auf Chart
4. User klickt "Approve" → Agent führt Trade aus

**Das Problem im Code:**

```tsx
// File: frontend/src/components/Fleet/AgentCockpit.tsx, Line 128-142

<div className="cockpit-chart">
    <div className="chart-placeholder">
        {/* ... */}
        <div className="chart-body">
            <p>📊 KlineCharts Integration</p>
            <p className="hint">Ghost Lines will appear here when agent proposes trades</p>
            {/* TODO: Hier fehlt der echte KlineChart! */}
        </div>
    </div>
</div>
```

---

## 🔧 Die Lösung

### Phase 1: Chart in Agent Cockpit integrieren

**Was wir bereits haben:**
- `KlineChartCore.tsx` - funktionierender Chart-Component (benutzt in App.tsx)
- Binance WebSocket Datafeed
- Toolbar mit Indikatoren und Drawing Tools

**Was zu tun ist:**

1. **KlineChartCore in AgentCockpit einbinden**
   - Import: `import KlineChartCore from '../Chart/KlineChartCore'`
   - Verwende `agent.symbol` und `agent.macro_timeframe` als Props
   - Ersetze den `<div className="chart-placeholder">` durch echten Chart

2. **Ghost Lines API implementieren**
   - KlineCharts unterstützt Overlays (Linien, Shapes)
   - Agent sendet `visual_snapshot` im Log-Eintrag:
     ```json
     {
       "status": "PROPOSING",
       "log_text": "EMA Cross detected. Proposing Long.",
       "visual_snapshot": [
         { "type": "line", "price": 95000, "color": "blue", "label": "Entry" },
         { "type": "line", "price": 94000, "color": "red", "label": "Stop Loss" },
         { "type": "line", "price": 97000, "color": "green", "label": "Take Profit" }
       ]
     }
     ```
   - Frontend liest `visual_snapshot` aus dem neuesten Log
   - Übergibt an KlineChartCore als `overlays` Prop
   - Chart zeichnet die Linien

3. **Backend: visual_snapshot Generierung**
   - Erweitere `TradingAgentInstance._synthesize_signals()`
   - Wenn Proposal erstellt wird, füge `visual_snapshot` hinzu:
     ```python
     visual_snapshot = [
         {"type": "line", "price": float(entry_price), "color": "#3b82f6", "label": "Entry"},
         {"type": "line", "price": float(stop_loss), "color": "#ef4444", "label": "SL"},
         {"type": "line", "price": float(take_profit), "color": "#10b981", "label": "TP"},
     ]
     ```
   - Speichern in `agent_logs.visual_snapshot` (JSONB Spalte)

---

### Phase 2: Real-Time Updates

**WebSocket Flow:**

```
Backend (Agent Loop)
    ↓ 
    [Agent erkennt Setup]
    ↓
    Speichert Log mit visual_snapshot
    ↓
    Broadcast via Redis Pub/Sub
    ↓
Frontend (WebSocket)
    ↓
    Update fleetStore.agentLogs
    ↓
    AgentCockpit re-rendert
    ↓
    KlineChartCore zeichnet Ghost Lines
```

**Bereits implementiert:**
- WebSocket-Verbindung in `fleetStore.ts`
- `connectFleetWebSocket()` empfängt Updates
- `agentLogs` wird aktualisiert

**Noch zu tun:**
- Overlay-Rendering in `KlineChartCore.tsx`
- Prop `overlays?: VisualOverlay[]` hinzufügen
- `useEffect` Hook, der Overlays auf Chart zeichnet

---

### Phase 3: Multi-Timeframe View (Optional, später)

**Laut Plan:**
- Agent analysiert MACRO (z.B. 4h) und MICRO (z.B. 15m)
- Cockpit könnte beide Charts nebeneinander zeigen
- Für jetzt: **Nur MACRO-Chart** (Hauptansicht)

---

## 📋 Action Items (Today)

### 1. Frontend: Chart Integration
- [ ] `AgentCockpit.tsx` - Ersetze Placeholder durch `<KlineChartCore>`
- [ ] `KlineChartCore.tsx` - Add `overlays` Prop und Rendering-Logik
- [ ] Test: Chart wird im Cockpit angezeigt

### 2. Backend: Visual Snapshot
- [ ] `TradingAgentInstance._synthesize_signals()` - Generate `visual_snapshot`
- [ ] Ensure `agent_logs.visual_snapshot` is populated
- [ ] Test: Log-Einträge enthalten `visual_snapshot` JSON

### 3. Frontend: Ghost Lines Rendering
- [ ] `AgentCockpit.tsx` - Read latest log's `visual_snapshot`
- [ ] Pass to `KlineChartCore` as `overlays` prop
- [ ] `KlineChartCore` draws lines on chart
- [ ] Test: Linien erscheinen auf Chart wenn Agent PROPOSING ist

### 4. Polish
- [ ] Styling: Ghost Lines mit Transparenz/Dash-Style
- [ ] Animation: Fade-in beim Erscheinen
- [ ] Cleanup: Remove old overlays when agent changes state

---

## 🎨 Visual Design (Ghost Lines)

**Entry Line:**
- Farbe: `#3b82f6` (blau)
- Stil: durchgezogen, 2px
- Label: "Entry: $95,000"

**Stop Loss:**
- Farbe: `#ef4444` (rot)
- Stil: gestrichelt
- Label: "SL: $94,000"

**Take Profit:**
- Farbe: `#10b981` (grün)
- Stil: gestrichelt
- Label: "TP: $97,000"

**Optional (später):**
- Trendlines (gelb)
- Support/Resistance Zones (transparente Boxes)
- Fibonacci Levels

---

## 🧪 Testing Workflow

1. **Start Agent** → Status: SCANNING
2. **Wait for Proposal** → Status: PROPOSING
3. **Check Cockpit:**
   - Chart zeigt BTC/USDT
   - 3 Ghost Lines erscheinen (Entry, SL, TP)
   - Log zeigt: "Analyzing 15m entry... EMA Cross detected."
4. **Approve** → Lines verschwinden, Order wird ausgeführt
5. **Reject** → Lines verschwinden, Agent geht zurück zu SCANNING

---

## 📦 Dependencies

**Already Installed:**
- `klinecharts: ^9.8.10` (Chart Library)
- `@klinecharts/pro: ^0.1.1` (Pro Features, optional)

**No new packages needed!**

---

## 🚀 Next Steps After This Session

1. **AI Chat Interface** (aus Plan):
   - User kann Agent fragen: "Why are you waiting?"
   - Agent antwortet: "RSI is neutral, waiting for dip to 95k."
   - Backend: OpenAI/Claude Integration für Agent Reasoning

2. **Multi-Agent Comparison:**
   - Split-screen: 2 Agents nebeneinander
   - Compare BTC Agent vs SOL Agent performance

3. **Strategy Backtesting Visualization:**
   - Ghost Lines auch in Backtest-Mode
   - Replay: Wie hätte Agent gehandelt in der Vergangenheit?

---

## 📌 Current Architecture

```
Frontend:
├── FleetView (Overview Table)
│   └── [View Agent] Button
│       └── AgentCockpit (Detail View) ← WE ARE HERE
│           ├── Left: Chart (TODO: Add KlineChartCore)
│           │   └── Ghost Lines (TODO: Overlays)
│           └── Right: Sidebar
│               ├── Session Stats ✅
│               └── Agent Log ✅

Backend:
├── TradingAgentInstance (Background Loop)
│   ├── _run_loop() ✅
│   ├── _analyze_macro() ✅
│   ├── _analyze_micro() ✅
│   └── _synthesize_signals() ← TODO: Add visual_snapshot
│
└── AgentFleetManager
    ├── start_agent() ✅
    ├── pause_agent() ✅
    └── _on_agent_log() ← Broadcasts to WebSocket ✅
```

---

## 🔑 Key Insight

**Das System funktioniert bereits!**
- Agent läuft im Background
- Logs werden gespeichert und übertragen
- Frontend empfängt Updates

**Was fehlt:**
- **Nur die Visualisierung** der Agent-Gedanken (Ghost Lines)
- Chart ist vorhanden (KlineChartCore), nur nicht eingebunden

**Einfache Lösung:**
1. Chart-Component in Cockpit einfügen (10 Minuten)
2. `visual_snapshot` im Backend generieren (15 Minuten)
3. Overlays rendern (20 Minuten)

**Geschätzter Aufwand: 45-60 Minuten** 🎯

---

*Last Updated: 2025-12-09 23:30*  
*Status: Ready to implement Chart + Ghost Lines*
