# Implementation Notes: Leverage & Margin Mode

**Datum:** 16. Dezember 2025  
**Feature:** Börsenkompatible Leverage- und Margin-Mode-Parameter für Trading Agents

## Übersicht

Die Trading-Plattform wurde erweitert, um vollständige Kompatibilität mit Börsen wie Bitget und Binance herzustellen. Agents können nun Leverage (1-150x) und Margin Mode (ISOLATED/CROSS) konfigurieren.

## Implementierte Änderungen

### 1. Datenmodell (Backend)

**Datei:** `backend/app/models/base.py`
- ✅ Neue Spalten in `TradingAgent` Model:
  - `leverage`: Integer (1-150), Default: 10
  - `margin_mode`: String ("ISOLATED" | "CROSS"), Default: "ISOLATED"

**Migration:** `a1b2c3d4e5f6_add_leverage_and_margin_mode_to_trading_agents.py`
- ✅ Erfolgreich in Docker ausgeführt
- ✅ Spalten mit Default-Werten hinzugefügt

### 2. Backend Schemas

**Datei:** `backend/app/schemas/trading_agent.py`
- ✅ `TradingAgentBase`: Neue Felder mit Validierung
- ✅ `TradingAgentCreate`: Erbt neue Felder
- ✅ `TradingAgentUpdate`: Optional updatable
- ✅ `TradingAgentResponse`: Inkludiert neue Felder

### 3. Fleet Manager & Agent Instance

**Datei:** `backend/app/services/fleet_manager.py`
- ✅ `deploy_agent()`: Parameter `leverage` und `margin_mode` hinzugefügt
- ✅ Agent-Instantiierung mit neuen Parametern
- ✅ `start_agent()`: Restore mit leverage/margin_mode

**Datei:** `backend/app/services/trading_agent_instance.py`
- ✅ `__init__()`: Parameter `leverage` und `margin_mode`
- ✅ `_execute_trade()`: Verwendet `self.leverage` statt hardcoded 10x

**Datei:** `backend/app/api/api_v1/endpoints/fleet.py`
- ✅ `deploy_agent` Endpoint: Übergibt leverage/margin_mode an FleetManager

### 4. Frontend Types

**Datei:** `frontend/src/store/fleetStore.ts`
- ✅ `TradingAgent` Interface: Neue Felder
- ✅ `DeployAgentParams` Interface: Neue Felder
- ✅ Wizard State: Default-Werte (10x, ISOLATED)

### 5. Deploy Wizard UI

**Datei:** `frontend/src/components/Fleet/DeployAgentModal.tsx`

**Step 2 (Trading Mode & Budget):**
- ✅ Margin Mode Selector (ISOLATED/CROSS)
  - Isolated: "Risk limited to position margin"
  - Cross: "Shares full margin balance"
- ✅ Leverage Slider (1-150x)
  - Gradient-Farben: Grün → Blau → Orange → Rot
  - Labels bei 1x, 30x, 60x, 90x, 120x, 150x
  - Live-Berechnung: Max Position = Budget × Leverage

**Step 4 (Risk Management - Summary):**
- ✅ Zeigt Leverage und Margin Mode
- ✅ Zeigt maximale Position-Size

**Datei:** `frontend/src/components/Fleet/DeployAgentModal.css`
- ✅ `.margin-mode-selector`: Grid-Layout für ISOLATED/CROSS
- ✅ `.leverage-slider`: Gradient-Slider mit Custom-Styling
- ✅ `.leverage-labels`: Positionierung der Werte-Labels

## Exchange-Kompatibilität

### Bitget / Binance Parameter-Mapping

| Platform Parameter | Agent Parameter | Typ | Range | Default |
|-------------------|-----------------|-----|-------|---------|
| Leverage | `leverage` | int | 1-150 | 10 |
| Margin Mode | `margin_mode` | string | ISOLATED/CROSS | ISOLATED |
| Budget (Margin) | `budget` | decimal | >0 | 1000 |

### Order Execution Flow

1. **Agent erstellt Trade-Proposal**
   - Berechnet position_size basierend auf `risk_per_trade` % vom Budget
   
2. **Trade Execution** (`_execute_trade()`)
   ```python
   margin = float(self.budget * self.risk_per_trade)  # z.B. 10% von 1000 = 100 USDT
   leverage = self.leverage  # z.B. 10x
   
   # Max Position = margin × leverage = 100 × 10 = 1000 USDT
   ```

3. **Paper Trading Service**
   - `place_order()` erhält `leverage` Parameter
   - Simuliert Margin-Berechnung wie auf Exchange

4. **Live Trading** (TODO)
   - CCXT Integration muss `leverage` und `margin_mode` an Exchange übergeben
   - Bitget: `set_leverage()` und `set_margin_mode()`
   - Binance: `fapiPrivate_post_leverage()` und `set_margin_type()`

## UI-Flow

### Agent Deployment Wizard

```
Step 1: Name & Symbol
   ↓
Step 2: Trading Mode & Budget
   ├─ Paper / Live
   ├─ Budget (USDT)
   ├─ 🆕 Margin Mode (ISOLATED/CROSS)
   └─ 🆕 Leverage Slider (1-150x)
       → Shows: Max Position = Budget × Leverage
   ↓
Step 3: Strategy Selection
   ↓
Step 4: Risk Management
   └─ Summary zeigt:
      • Leverage: 10x (ISOLATED)
      • Max Position: $10,000
```

## Testing Checklist

- [ ] Agent mit Leverage 1x deployen
- [ ] Agent mit Leverage 150x deployen
- [ ] Margin Mode ISOLATED testen
- [ ] Margin Mode CROSS testen
- [ ] Paper Trading: Order Execution mit korreker Leverage
- [ ] Live Trading: CCXT Integration (wenn implementiert)
- [ ] Migration Rollback testen
- [ ] Frontend: Leverage-Slider Responsiveness
- [ ] Frontend: Wizard Summary korrekt

## Offene Punkte

1. **Live Trading Integration**
   - CCXT Service muss `set_leverage()` und `set_margin_mode()` implementieren
   - Pro Exchange unterschiedliche API-Calls
   
2. **Position Management**
   - Active Position Card könnte Leverage anzeigen
   - PnL-Berechnung berücksichtigt Leverage implizit

3. **Risk Management**
   - Liquidation-Price berechnen und anzeigen
   - Margin Call Warnings bei hohem Leverage

## Weitere Infos

- Screenshots der Bitget/Binance UIs sind dokumentiert
- Default-Werte entsprechen Börsen-Standards
- ISOLATED ist sicherer für Anfänger (empfohlener Default)
