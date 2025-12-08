# Session Notes - 8. Dezember 2025

## Zusammenfassung

In dieser Session wurde die Chart-Bibliothek von **D3.js** auf **KlineCharts Pro** umgestellt. Die neue Lösung bietet eine professionelle "out-of-the-box" Trading-Chart-Erfahrung mit integrierten Indikatoren und Zeichenwerkzeugen.

---

## Implementierte Änderungen

### 1. KlineCharts Pro Integration

**Neue Dependencies:**
```json
{
  "klinecharts": "^9.8.10",
  "@klinecharts/pro": "^0.1.1"
}
```

**Neue Dateien:**

| Datei | Beschreibung |
|-------|-------------|
| `frontend/src/components/Chart/KlineChartPro.tsx` | React-Wrapper für KlineCharts Pro |
| `frontend/src/services/BinanceDatafeed.ts` | Custom Datafeed für Backend/Binance WebSocket |

**Geänderte Dateien:**

| Datei | Änderung |
|-------|----------|
| `frontend/package.json` | Neue Dependencies hinzugefügt |
| `frontend/src/App.tsx` | Import von `KlineChartPro` statt `D3Chart` |
| `frontend/src/index.css` | CSS-Fixes für Chart-Container-Sizing |

**Umbenannte Dateien:**

| Alt | Neu | Grund |
|-----|-----|-------|
| `D3Chart.tsx` | `D3ChartLegacy.tsx` | Als Fallback beibehalten |

---

### 2. Features von KlineCharts Pro

- ✅ **40+ Built-in Indikatoren** (RSI, MACD, Bollinger Bands, etc.)
- ✅ **Zeichenwerkzeuge** (Trendlines, Fibonacci, Channels, etc.)
- ✅ **Canvas-basiert** (performanter als D3 SVG)
- ✅ **Live Binance WebSocket** Updates
- ✅ **Responsive** auf Symbol/Timeframe-Änderungen
- ✅ **Dark Theme** passend zum Trading UI

---

### 3. Custom BinanceDatafeed

Die `BinanceDatafeed.ts` implementiert das `Datafeed` Interface von KlineCharts Pro:

```typescript
class BinanceDatafeed implements Datafeed {
    // Historische Daten vom Backend holen
    async getHistoryKLineData(symbol, period, from, to) { ... }
    
    // Live-Updates via Binance WebSocket
    subscribe(symbol, period, callback) { ... }
    unsubscribe(symbol, period) { ... }
}
```

**Datenfluss:**
1. Historische OHLCV-Daten → Backend (`/api/v1/market/ohlcv`)
2. Live-Updates → Direkt von Binance WebSocket (`wss://stream.binance.com`)

---

### 4. Docker Integration

Die neuen Packages werden **im Docker-Container** installiert, nicht lokal:

```bash
# Container neu bauen (inkl. npm install)
cd infra
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d --renew-anon-volumes
```

> **Wichtig:** `--renew-anon-volumes` erneuert das anonyme Volume für `node_modules`

---

## Bekannte Limitationen

### Settings-Modal Labels (KLineCharts Pro Lokalisierung)

**Problem:**
Die Labels im Settings-Modal zeigen technische Parameter-Namen statt benutzerfreundliche Bezeichnungen:
- `candle_type` statt "Candle Type"
- `high_price_show` statt "Show High Price"
- `indicator_last_value_show` statt "Show Indicator Values"

**Ursache:**
KlineCharts Pro verwendet intern **Solid.js** für seine UI-Komponenten. Die `registerLocale()` Funktion der Core `klinecharts` Library beeinflusst diese Komponenten nicht.

**Versuchte Lösungen:**
1. ❌ `registerLocale('en-US', {...})` → Wird von Pro UI ignoriert
2. ❌ Container-Restart → Kein Effekt
3. ❌ Vollständige en-US.json Übersetzungen → Kein Effekt

---

## Empfehlungen für die Zukunft

### Option 1: Akzeptieren & Dokumentieren (Empfohlen für jetzt)
Die technischen Namen belassen. Die Chart-Funktionalität ist vollständig und die Settings werden selten genutzt.

### Option 2: Custom Settings-Modal
Ein eigenes React-Modal erstellen, das die KlineCharts Pro API verwendet:
```typescript
// Beispiel-Konzept
const CustomSettingsModal = () => {
    const handleCandleTypeChange = (type: string) => {
        chartRef.current?.setStyles({
            candle: { type }
        });
    };
    // ... weitere Settings
};
```

### Option 3: CSS-Workaround
Mit CSS `::after` pseudo-elements die Labels visuell überschreiben:
```css
/* Beispiel - nicht empfohlen */
label[for="candle_type"]::after {
    content: "Candle Type";
    /* ... */
}
```

### Option 4: Library-Update abwarten
Auf ein zukünftiges Update von KlineCharts Pro hoffen, das die Lokalisierung korrekt implementiert.

---

## Git Commit

```
feat: Integrate KlineCharts Pro replacing D3.js chart

- Add klinecharts and @klinecharts/pro dependencies
- Create BinanceDatafeed.ts for custom datafeed implementation
- Create KlineChartPro.tsx React wrapper with dark theme
- Update App.tsx to use new chart component
- Rename D3Chart.tsx to D3ChartLegacy.tsx as fallback
- Add CSS fixes for chart container sizing

Features:
- 40+ built-in indicators
- Drawing tools (trendlines, fibonacci, etc.)
- Canvas-based rendering (performant)
- Live Binance WebSocket updates
- Responsive to symbol/timeframe changes
```

---

## Nächste Schritte

- [ ] KlineCharts Pro Settings-Labels lösen (siehe Empfehlungen oben)
- [ ] WebSocket-Verbindungen optimieren (aktuell mehrere parallele Verbindungen)
- [ ] Position-Overlays auf KlineCharts Pro implementieren
- [ ] Backtest-Ergebnisse im Chart anzeigen

---

## Update 01:10 - Chart Farb-Customization

### 5. Chart Color Picker Feature

**Neue Komponente:** `frontend/src/components/Chart/ChartSettings.tsx`

Ein Settings-Popup (⚙️ Icon oben rechts im Chart) mit:
- 🎨 **Background Color Picker** - Hintergrundfarbe des Charts ändern
- ✏️ **Text Color Picker** - Textfarbe für Achsen und Toolbar ändern
- 📍 **12 Preset-Farben** pro Picker (dunkle Farben für Hintergrund, helle für Text)
- 👁️ **Live-Preview** der Farbkombination
- 💾 **Persistenz** via localStorage

**Geänderte Dateien:**

| Datei | Änderung |
|-------|----------|
| `frontend/src/store/tradingStore.ts` | `chartBackgroundColor` und `chartTextColor` State mit localStorage |
| `frontend/src/components/Chart/KlineChartPro.tsx` | Integration von ChartSettings + CSS Custom Properties |
| `frontend/src/index.css` | KlineCharts Pro Toolbar Dark Theme Overrides |

**CSS Custom Properties:**
```css
--chart-bg-color    /* Hintergrundfarbe */
--chart-text-color  /* Textfarbe */
```

Diese werden dynamisch gesetzt und steuern das Styling der KlineCharts Pro Toolbar.

### 6. Timeframe-Erweiterung

**Neue Timeframes hinzugefügt:**
- `1s` (1 Sekunde)
- `10s` (10 Sekunden)  
- `30s` (30 Sekunden)

Binance unterstützt 1s-Daten via WebSocket und das Backend (CCXT) liefert die historischen Daten.

---

## Git Commits

### Commit 1: KlineCharts Pro Integration
```
feat: Integrate KlineCharts Pro replacing D3.js chart

- Add klinecharts and @klinecharts/pro dependencies
- Create BinanceDatafeed.ts for custom datafeed implementation
- Create KlineChartPro.tsx React wrapper with dark theme
- Update App.tsx to use new chart component
- Rename D3Chart.tsx to D3ChartLegacy.tsx as fallback
- Add CSS fixes for chart container sizing
```

### Commit 2: Chart Customization (29eb650)
```
feat: Add chart customization with background and text color pickers

- Add 1-second timeframe support for Binance WebSocket
- Create ChartSettings component with dual color pickers
- Add chartBackgroundColor and chartTextColor to tradingStore with localStorage persistence
- Apply CSS custom properties for KlineCharts Pro toolbar styling
- Include live preview and preset color palettes
```

---

## Update 01:45 - Paper Trading Position Update Bug Fix

### 7. Bug: Orders aktualisierten bestehende Positionen nicht

**Problem:**
Beim Platzieren neuer Market Orders für ein Symbol mit bereits offener Position wurde die Position nicht aktualisiert. Size und Entry Price blieben unverändert, obwohl die Order in `paper_orders` korrekt als `FILLED` markiert wurde.

**Root Cause:**
In `backend/app/services/paper_trading.py` wurde SQLAlchemy `== None` verwendet, um nach manuellen Trades (ohne `strategy_id`) zu suchen. Bei async SQLAlchemy wird dies nicht korrekt zu `IS NULL` übersetzt.

**Fix:**
```python
# VORHER (fehlerhaft)
result = await self.db.execute(select(PaperPosition).where(
    PaperPosition.strategy_id == strategy_id  # Funktioniert nicht für None
))

# NACHHER (korrekt)
if strategy_id is None:
    result = await self.db.execute(select(PaperPosition).where(
        PaperPosition.strategy_id.is_(None)  # Korrekter NULL-Vergleich
    ))
else:
    result = await self.db.execute(select(PaperPosition).where(
        PaperPosition.strategy_id == strategy_id
    ))
```

**Geänderte Datei:**
| Datei | Zeilen |
|-------|--------|
| `backend/app/services/paper_trading.py` | 174-188 |

**Verifiziert:**
| Metrik | Vorher | Nachher |
|--------|--------|---------|
| BTC Position Size | 0.0887 | 0.1053 |
| Entry Price | 90159.55 | 90197.64 (gewichteter Ø) |

---

## Git Commits (aktualisiert)

### Commit 3: Paper Trading Bug Fix
```
fix: Paper trading position update with correct NULL comparison

- Use is_(None) for SQLAlchemy async queries instead of == None
- Fixes issue where new orders did not update existing positions
- Position size and entry price now correctly averaged
```

---

## Referenzen

- [KlineCharts Pro GitHub](https://github.com/klinecharts/pro)
- [KlineCharts Pro Dokumentation](https://pro.klinecharts.com)
- [KlineCharts Pro en-US.json](https://github.com/klinecharts/pro/blob/main/src/i18n/en-US.json)
- [SQLAlchemy NULL Comparison](https://docs.sqlalchemy.org/en/20/core/sqlelement.html#sqlalchemy.sql.expression.ColumnElement.is_)

## KlineCharts Core Migration
**Status**: Completed
**Ziel**: Entfernung des `@klinecharts/pro` Wrappers für vollen API-Zugriff auf die Chart-Instanz.

### Änderungen
1.  **Core Component (`KlineChartCore.tsx`)**:
    *   Neuer React-Wrapper basierend auf `klinecharts` (Core).
    *   Integration von Position Overlays (Entry, TP, SL) über `chart.createOverlay()`.
    *   Dark Theme passend zur App-UI.
    *   WebSocket-Anbindung für Live-Daten via `BinanceDatafeed`.

2.  **Custom Toolbar (`KlineToolbar.tsx`)**:
    *   Eigene Implementation der Toolbar.
    *   Features: Timeframe-Buttons (1s - 1d), Indikator-Auswahl, "Custom Strategies" Button.
    *   Bugfix: Korrektes Hinzufügen und Entfernen von Indikatoren (Pane-Management).

3.  **Indicator System**:
    *   `IndicatorModal.tsx`: Neues Modal für die Auswahl von Indikatoren.
    *   Logik zur Unterscheidung zwischen Main- (Overlay) und Sub-Indikatoren (separate Pane).

4.  **Integration**:
    *   `App.tsx` auf `KlineChartCore` umgestellt.

### Verifikation
*   Chart rendert korrekt mit Candlesticks.
*   Timeframe-Wechsel funktioniert.
*   Indikatoren lassen sich hinzufügen und entfernen (Bugfix bestätigt).
*   Position Overlays werden angezeigt.
