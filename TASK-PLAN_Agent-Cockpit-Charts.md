# 🎯 Task Plan: Agent Cockpit - Chart & Ghost Lines Integration

**Datum:** 9. Dezember 2025  
**Ziel:** Vollständige Visualisierung der Agent-Gedanken mit KlineCharts + Ghost Lines  
**Geschätzter Aufwand:** 1-2 Stunden

---

## 📋 Task Overview

| # | Task | Status | Zeit | Prio |
|---|------|--------|------|------|
| **0** | **BUG: Strategien nicht ladbar im Deploy Modal** | 🟡 REVIEW | 15min | 🔥 HIGH |
| **1** | Frontend: Chart in AgentCockpit einbinden | 🟢 DONE | 15min | HIGH |
| **2** | Backend: visual_snapshot Generierung | 🟢 DONE | 20min | HIGH |
| **3** | Frontend: Ghost Lines Rendering | 🟢 DONE | 20min | HIGH |
| **3.5** | **BONUS: Live Price Ticker** | 🟢 DONE | 20min | MED |
| **4** | Testing & Polish | 🔵 TESTING | 15min | MED |
| **5** | Documentation & Commit | 🟡 IN PROGRESS | 10min | LOW |

**Status-Legende:**
- ⚪ TODO - Noch nicht begonnen
- 🟡 IN PROGRESS - Wird gerade bearbeitet
- 🟢 DONE - Abgeschlossen
- 🔴 BLOCKED - Problem, kann nicht fortfahren
- 🔵 TESTING - In Test-Phase

---

## 🔴 Task 0: BUG FIX - Strategien nicht ladbar

**Problem:**
- Deploy Modal Step 3 zeigt "Strategien konnten nicht geladen werden"
- Dropdown zeigt nur "None (Manual)"
- Wurde bereits einmal gefixt, tritt aber wieder auf

**Debugging Schritte:**

- [ ] 0.1 - Browser DevTools öffnen, Network Tab prüfen
  - Wird `/api/v1/strategies` Request gesendet?
  - Was ist der Status Code? (200 OK oder 403 Forbidden?)
  
- [ ] 0.2 - Backend Logs checken
  ```bash
  docker compose logs backend --tail=50 | grep strategies
  ```

- [ ] 0.3 - Frontend Code Review
  - File: `frontend/src/components/Fleet/DeployAgentModal.tsx`
  - Zeile ~150-200: Strategy Loading Logic
  - Prüfen: `fetchStrategies()` wird aufgerufen?

- [ ] 0.4 - API Endpoint testen
  ```bash
  curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/v1/strategies
  ```

**Mögliche Ursachen:**
1. ✅ CORS (bereits gefixt) 
2. ❓ Authentication Token fehlt/abgelaufen
3. ❓ Backend Endpoint `/strategies` antwortet nicht
4. ❓ Frontend State Problem (strategies Array leer)

**Fix-Kandidaten:**
- Wenn 403: Auth-Token in API-Call prüfen
- Wenn 500: Backend Error-Handling
- Wenn leeres Array: DB hat keine Strategien (Seed-Data fehlt?)

---

## Task 1: Frontend - Chart Integration in AgentCockpit

**Ziel:** KlineChartCore Component im Agent Cockpit anzeigen

### Subtasks:

- [ ] 1.1 - Import KlineChartCore in AgentCockpit.tsx
  ```tsx
  import KlineChartCore from '../Chart/KlineChartCore';
  ```

- [ ] 1.2 - Chart Placeholder ersetzen
  - **File:** `frontend/src/components/Fleet/AgentCockpit.tsx`
  - **Zeile:** ~128-142
  - **Änderung:** Ersetze `<div className="chart-placeholder">` durch:
    ```tsx
    <div className="cockpit-chart-container">
      <KlineChartCore 
        symbol={agent.symbol}
        timeframe={agent.macro_timeframe}
        overlays={ghostLines}
      />
    </div>
    ```

- [ ] 1.3 - State für Ghost Lines vorbereiten
  ```tsx
  const [ghostLines, setGhostLines] = useState<VisualOverlay[]>([]);
  ```

- [ ] 1.4 - CSS Styling anpassen
  - **File:** `frontend/src/components/Fleet/AgentCockpit.css`
  - Chart soll Fullscreen im linken Panel sein
  - Keine feste Höhe, sondern `flex: 1`

**Akzeptanzkriterien:**
- ✅ Chart wird im Cockpit angezeigt
- ✅ Chart zeigt korrektes Symbol (BTC/USDT)
- ✅ Chart ist responsive
- ✅ Keine Console-Errors

**Dateien zu ändern:**
- `frontend/src/components/Fleet/AgentCockpit.tsx`
- `frontend/src/components/Fleet/AgentCockpit.css`

---

## Task 2: Backend - Visual Snapshot Generierung

**Ziel:** Agent erstellt `visual_snapshot` JSON für Ghost Lines

### Subtasks:

- [ ] 2.1 - TypeScript Interface für VisualOverlay definieren
  - **File:** `frontend/src/store/fleetStore.ts` (oder neue types.ts)
  ```typescript
  export interface VisualOverlay {
    type: 'line' | 'box' | 'trendline';
    price?: number;
    priceHigh?: number;
    priceLow?: number;
    color: string;
    label: string;
    style?: 'solid' | 'dashed' | 'dotted';
  }
  ```

- [ ] 2.2 - Backend: visual_snapshot in _synthesize_signals
  - **File:** `backend/app/services/trading_agent_instance.py`
  - **Method:** `_synthesize_signals()` (Zeile ~240-260)
  - **Änderung:** Wenn Proposal erstellt wird:
    ```python
    if macro == SignalType.LONG and micro == SignalType.LONG:
        # Calculate entry, SL, TP
        entry_price = current_price
        stop_loss = entry_price * 0.98
        take_profit = entry_price * 1.04
        
        # Create visual snapshot
        visual_snapshot = [
            {
                "type": "line",
                "price": float(entry_price),
                "color": "#3b82f6",
                "label": f"Entry: ${entry_price:,.2f}",
                "style": "solid"
            },
            {
                "type": "line",
                "price": float(stop_loss),
                "color": "#ef4444",
                "label": f"Stop Loss: ${stop_loss:,.2f}",
                "style": "dashed"
            },
            {
                "type": "line",
                "price": float(take_profit),
                "color": "#10b981",
                "label": f"Take Profit: ${take_profit:,.2f}",
                "style": "dashed"
            }
        ]
        
        await self._log(
            "Trade proposal generated",
            {
                "entry": float(entry_price),
                "sl": float(stop_loss),
                "tp": float(take_profit)
            },
            visual_snapshot=visual_snapshot
        )
    ```

- [ ] 2.3 - Update _log() Method Signature
  - **File:** `backend/app/services/trading_agent_instance.py`
  - **Method:** `_log()`
  - Add parameter: `visual_snapshot: Optional[List[Dict]] = None`
  - Pass to log entry

- [ ] 2.4 - Database: Verify visual_snapshot column
  - **Table:** `agent_logs`
  - **Column:** `visual_snapshot` JSONB
  - Should already exist (check migration)

**Akzeptanzkriterien:**
- ✅ Agent-Log enthält `visual_snapshot` JSON
- ✅ Kann in DB abgerufen werden
- ✅ Format ist korrekt (Array of objects)

**Dateien zu ändern:**
- `backend/app/services/trading_agent_instance.py`

---

## Task 3: Frontend - Ghost Lines Rendering

**Ziel:** Chart zeichnet Linien basierend auf visual_snapshot

### Subtasks:

- [ ] 3.1 - Add overlays Prop zu KlineChartCore
  - **File:** `frontend/src/components/Chart/KlineChartCore.tsx`
  - **Interface:**
    ```tsx
    interface KlineChartCoreProps {
      symbol: string;
      timeframe: string;
      overlays?: VisualOverlay[];  // NEU
    }
    ```

- [ ] 3.2 - Overlay Rendering useEffect
  - **File:** `frontend/src/components/Chart/KlineChartCore.tsx`
  - Nach Chart-Initialisierung, neuer useEffect:
    ```tsx
    useEffect(() => {
      if (!chartRef.current || !overlays || overlays.length === 0) return;
      
      // Clear old overlays
      chartRef.current.removeOverlay();
      
      // Draw new overlays
      overlays.forEach(overlay => {
        if (overlay.type === 'line') {
          chartRef.current.createOverlay({
            name: 'horizontalStraightLine',
            points: [{ value: overlay.price, timestamp: Date.now() }],
            styles: {
              line: {
                color: overlay.color,
                style: overlay.style === 'dashed' ? 'dashed' : 'solid',
                size: 2
              }
            },
            text: overlay.label
          });
        }
      });
    }, [overlays]);
    ```

- [ ] 3.3 - AgentCockpit: Extract visual_snapshot from logs
  - **File:** `frontend/src/components/Fleet/AgentCockpit.tsx`
  - Nach logs werden geladen:
    ```tsx
    const latestProposingLog = logs.find(log => 
      log.status === 'PROPOSING' && log.visual_snapshot
    );
    
    const ghostLines = latestProposingLog?.visual_snapshot || [];
    ```

- [ ] 3.4 - Pass ghostLines to Chart
  ```tsx
  <KlineChartCore 
    symbol={agent.symbol}
    timeframe={agent.macro_timeframe}
    overlays={ghostLines}
  />
  ```

**Akzeptanzkriterien:**
- ✅ Wenn Agent PROPOSING, erscheinen 3 Linien auf Chart
- ✅ Linien haben korrekte Farben (blau/rot/grün)
- ✅ Labels sind lesbar
- ✅ Linien verschwinden wenn Agent Status ändert

**Dateien zu ändern:**
- `frontend/src/components/Chart/KlineChartCore.tsx`
- `frontend/src/components/Fleet/AgentCockpit.tsx`

---

## Task 4: Testing & Polish

### Subtasks:

- [ ] 4.1 - Manual Testing Flow
  1. Agent starten
  2. Warten bis SCANNING
  3. (Simuliert) Agent wechselt zu PROPOSING
  4. Cockpit öffnen → Ghost Lines sollten sichtbar sein
  5. Approve klicken → Lines verschwinden
  6. Agent geht zu ACTIVE/IN_POSITION

- [ ] 4.2 - Mock Data für Testing (wenn Agent nicht echte Signale findet)
  - **File:** `backend/app/services/trading_agent_instance.py`
  - Add Debug-Mode: nach 30 Sekunden SCANNING → fake PROPOSING
  ```python
  if DEBUG_MODE and self._status == AgentStatus.SCANNING:
      # Force proposal for testing
      await self._create_mock_proposal()
  ```

- [ ] 4.3 - CSS Polish
  - Ghost Lines mit leichter Transparenz (opacity: 0.8)
  - Animation beim Erscheinen (fade-in)
  - Hover-Effect auf Linien (optional)

- [ ] 4.4 - Error Handling
  - Wenn visual_snapshot malformed → log error, don't crash
  - Wenn Chart nicht lädt → show fallback message

- [ ] 4.5 - Browser Testing
  - [ ] Chrome ✅
  - [ ] Firefox
  - [ ] Safari (macOS)

**Akzeptanzkriterien:**
- ✅ Keine Console-Errors
- ✅ Chart + Lines funktionieren in allen Browsern
- ✅ Performance ist OK (keine Lags)

---

## Task 5: Documentation & Git

### Subtasks:

- [ ] 5.1 - Update SESSION-NOTES_2025-12-09.md
  - Mark tasks as ✅ DONE
  - Add screenshots (optional)

- [ ] 5.2 - Code Comments
  - Add JSDoc comments to new functions
  - Explain overlay rendering logic

- [ ] 5.3 - Git Commit
  ```bash
  git add .
  git commit -m "feat: Agent Cockpit Chart + Ghost Lines Integration
  
  - Add KlineChartCore to AgentCockpit
  - Backend generates visual_snapshot in agent logs
  - Frontend renders Ghost Lines (Entry/SL/TP)
  - Fix: Strategies not loading in Deploy Modal
  
  Closes #XX"
  
  git push origin 001-autarkic-trading-platform
  ```

- [ ] 5.4 - README Update (optional)
  - Add section "Agent Visualization"
  - Add screenshot of Ghost Lines

---

## 🚀 Execution Order

**WICHTIG: Richtige Reihenfolge!**

1. **ZUERST:** Task 0 (Bug Fix Strategies) 🔴
   - Ohne Strategien kann kein Agent deployed werden
   - Blockiert alle anderen Tasks

2. **DANN:** Task 1 (Frontend Chart Integration)
   - Chart muss da sein bevor wir Overlays zeichnen

3. **DANN:** Task 2 (Backend Visual Snapshot)
   - Daten müssen generiert werden

4. **DANN:** Task 3 (Frontend Ghost Lines)
   - Rendering basiert auf Backend-Daten

5. **ABSCHLUSS:** Task 4 & 5 (Testing & Docs)

---

## 🎯 Success Criteria (Definition of Done)

**Alle Tasks sind erledigt wenn:**

✅ Deploy Modal kann Strategien laden  
✅ Agent Cockpit zeigt funktionierenden Chart  
✅ Agent im Status PROPOSING zeigt Ghost Lines  
✅ Ghost Lines haben korrekte Farben/Labels  
✅ Lines verschwinden nach Approve/Reject  
✅ Keine Console-Errors  
✅ Code ist committed & gepusht  

---

## 📊 Progress Tracking

```
[████░░░░░░] 0/6 Tasks Done (0%)

Task 0: [░░░░░░░░░░] 0/4 Subtasks
Task 1: [░░░░░░░░░░] 0/4 Subtasks
Task 2: [░░░░░░░░░░] 0/4 Subtasks
Task 3: [░░░░░░░░░░] 0/4 Subtasks
Task 4: [░░░░░░░░░░] 0/5 Subtasks
Task 5: [░░░░░░░░░░] 0/4 Subtasks
```

**Update diesen Block nach jedem abgeschlossenen Subtask!**

---

*Last Updated: 2025-12-09 23:45*  
*Next Update: Nach Task 0 Completion*
