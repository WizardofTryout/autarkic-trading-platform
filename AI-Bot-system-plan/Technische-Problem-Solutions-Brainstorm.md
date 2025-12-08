# Technische Problem-Analyse: Fleet Deploy Modal API-Fehler

**Erstellt:** 2025-12-08 20:56
**Letzte Aktualisierung:** 2025-12-08 21:06
**Status:** In Bearbeitung

---

## UPDATE: Neue Erkenntnisse (21:06)

1. **Browser-Cache leeren hat geholfen** - Refresh-Problem mit BTC verschwunden
2. **BTC Agent erfolgreich erstellt** - Screenshot zeigt "Btctestinger" Agent
3. **Refresh-Problem bei SOL** - Wechsel von BTC zu SOL löst erneut Refresh aus
4. **Strategien werden NIE geladen** - Unabhängiges Problem

### Zwei getrennte Probleme identifiziert:
| Problem | Symptom | Vermutete Ursache |
|---------|---------|-------------------|
| A) Refresh bei Symbol-Wechsel | Seite lädt neu bei SOL | WebSocket Neuverbindung / Fehlerhafte Error-Handler |
| B) Strategien nicht geladen | "No strategies found" | API-Aufruf schlägt fehl (CORS/Backend) |

---

## 1. KERNPROBLEM A: Symbol-Wechsel Refresh

### Beobachtung:
- BTC → funktioniert nach Cache-Clear
- SOL → löst Refresh aus
- Möglicherweise WebSocket-Fehler beim Symbol-Wechsel

### Relevanter Code:
```typescript
// KlineChartCore.tsx (Zeile 249)
chartRef.current.applyNewData(klineData);  // Fehler: Cannot read properties of null
```

### Hypothese:
Wenn das Symbol geändert wird, wird der Chart zerstört und neu erstellt. Während dieser Zeit kann ein WebSocket-Event ankommen und versucht auf `chartRef.current` zuzugreifen, was `null` ist - dies könnte einen unhandled Error verursachen, der zum Reload führt.

---

## 2. KERNPROBLEM B: Strategien werden nicht geladen

Der Browser macht API-Requests direkt zu `http://backend:8000/api/v1/strategies/` statt über den Vite-Proxy zu gehen.

**Erwartetes Verhalten:**
```
Browser → localhost:5173/api/v1/strategies → [Vite Proxy] → backend:8000/api/v1/strategies
```

**Tatsächliches Verhalten:**
```
Browser → http://backend:8000/api/v1/strategies/ → ERR_NAME_NOT_RESOLVED
```

---

## 3. DIAGNOSTIK-ERGEBNISSE

### 3.1 Docker-Netzwerk
- ✅ Frontend Container läuft (Up)
- ✅ Backend Container läuft (Up 5 min)
- ✅ Frontend kann Backend pingen: `ping backend` → 172.26.0.2 (0% packet loss)
- ✅ Backend /health Endpoint erreichbar: `{"status":"ok"}`

### 3.2 Vite-Proxy Logs
```
[vite] http proxy error: /api/v1/strategies/active
Error: connect ECONNREFUSED 172.26.0.2:8000
```
**Auffällig:** ECONNREFUSED trotz laufendem Backend - möglicherweise Timing-Problem nach Container-Restarts.

### 3.3 API_BASE Konfiguration
- `frontend/src/services/api.ts` Zeile 3: `const API_BASE = '/api/v1';`
- ✅ Korrekt als relative URL definiert

### 3.4 Vite Proxy Konfiguration
- `frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://backend:8000',
    changeOrigin: true,
    secure: false,
  },
}
```
- ✅ Korrekt konfiguriert

---

## 4. LÖSUNGSVORSCHLÄGE

### Problem A: Symbol-Wechsel Refresh

**Fix 1:** Null-Check in KlineChartCore.tsx hinzufügen:
```typescript
if (chartRef.current) {
    chartRef.current.applyNewData(klineData);
}
```

**Fix 2:** WebSocket Error Handler verbessern um Crashes zu verhindern

### Problem B: Strategien nicht geladen

**Schritt 1:** Frontend Container komplett neu bauen:
```bash
cd infra
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

**Schritt 2:** Vite Proxy Debug-Modus aktivieren um zu sehen was passiert

---

## 5. NÄCHSTE SCHRITTE

1. ✅ Browser-Cache geleert
2. ⏳ Frontend Container neu bauen (--no-cache)
3. ⏳ Null-Check in KlineChartCore.tsx hinzufügen
4. ⏳ Strategies-API Aufruf debuggen
```typescript
proxy: {
  '/api': {
    target: 'http://backend:8000',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path, // Explicit no-rewrite
  },
}
```

### Schritt 4: Vite Dev Server Debug-Modus
Temporär in vite.config.ts:
```typescript
proxy: {
  '/api': {
    target: 'http://backend:8000',
    changeOrigin: true,
    secure: false,
    configure: (proxy, options) => {
      proxy.on('proxyReq', (proxyReq, req, res) => {
        console.log('Proxying:', req.method, req.url, '→', options.target);
      });
    },
  },
}
```

### Schritt 5: Als Fallback - Direkter API-Zugriff über localhost
Falls Proxy nicht funktioniert, könnte API_BASE auf `http://localhost:8000/api/v1` gesetzt werden (CORS muss dann korrekt konfiguriert sein).

---

## 5. EMPFEHLUNG

**Starte mit Schritt 1 und 2** - vollständiger Cache-Clear und Container-Neubau.

Wenn das nicht hilft, **Schritt 4** um zu sehen was der Proxy tatsächlich macht.
