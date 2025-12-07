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

## Referenzen

- [KlineCharts Pro GitHub](https://github.com/klinecharts/pro)
- [KlineCharts Pro Dokumentation](https://pro.klinecharts.com)
- [KlineCharts Pro en-US.json](https://github.com/klinecharts/pro/blob/main/src/i18n/en-US.json)
