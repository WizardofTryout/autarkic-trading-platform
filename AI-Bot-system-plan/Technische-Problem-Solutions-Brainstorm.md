# Vollständige Strukturanalyse: AI Trading Fleet

**Erstellt:** 2025-12-08 22:15
**Status:** Analyse abgeschlossen - Problem gelöst

---

## 1. IMPLEMENTATION PLAN REVIEW

### Phase 1: Infrastructure & Database ✅
| Komponente | Status | Datei |
|------------|--------|-------|
| Celery Worker | ✅ Vorhanden | `docker-compose.yml` (Zeile 118-139) |
| Celery Beat | ✅ Vorhanden | `docker-compose.yml` (Zeile 141-156) |
| Celery App | ✅ Vorhanden | `backend/app/core/celery_app.py` |
| DB Schema | ✅ Vorhanden | Alembic Migrationen |

### Phase 2: Backend Core Logic ✅
| Komponente | Status | Datei |
|------------|--------|-------|
| TradingAgentInstance | ✅ Vorhanden | `backend/app/services/trading_agent_instance.py` |
| Fleet Manager | ✅ Vorhanden | `backend/app/services/fleet_manager.py` |
| WebSocket Endpoint | ✅ Vorhanden | `backend/app/api/websockets/fleet_stream.py` |
| REST API Endpoints | ✅ Vorhanden | `backend/app/api/api_v1/endpoints/fleet.py` |

### Phase 3: Exchange Integration ❌
| Komponente | Status |
|------------|--------|
| Order Router | ❌ Nicht implementiert |
| CCXT Live Connector | ❌ Nicht implementiert |

### Phase 4: Frontend Mission Control ⚠️
| Komponente | Status | Datei | Notizen |
|------------|--------|-------|---------|
| FleetDashboard | ✅ | `FleetDashboard.tsx` | Funktioniert |
| DeployAgentModal | ✅ | `DeployAgentModal.tsx` | Strategien laden jetzt, Modal-Layout korrigiert |
| FleetStore | ✅ | `fleetStore.ts` | WebSocket funktioniert |
| AgentCockpit | ⚠️ | `AgentCockpit.tsx` | Nicht vollständig |

---

## 2. IDENTIFIZIERTE STRUKTURPROBLEME

### Problem A: Docker-Netzwerk Konfiguration
```yaml
# docker-compose.yml
frontend:
  networks:
    - public_net  # NUR public_net!

backend:
  networks:
    - public_net
    - app_net    # zusätzlich
    - data_net   # zusätzlich
```
**Bewertung:** Sollte funktionieren - beide in `public_net`.

---

### Problem B: Vite Proxy vs. WebSocket
```typescript
// fleetStore.ts Zeile 292
const wsUrl = `ws://${window.location.hostname}:8000/api/v1/fleet/ws/stream`;
```
**Korrekt:** WebSockets müssen direkt zu `:8000` gehen, nicht über Vite Proxy.

---

### Problem C: API_BASE Konfiguration (gelöst)
Vorher: `API_BASE = '/api/v1'` lief über Vite Proxy und funktionierte lokal, scheiterte aber im Browser weil `backend:8000` aus dem Docker-Netz nicht aufgelöst wurde.

---

## 3. DAS EIGENTLICHE PROBLEM

Browser-Requests landeten direkt auf `http://backend:8000/api/v1/strategies/` und scheiterten, da der Host aus dem Browser nicht resolvbar ist. Ursache: statische API-Base passte nur für Container-internen Traffic, nicht für Browser außerhalb des Docker-Netzes.

---

## 4. LÖSUNG (umgesetzt)

### Fix 1: Dynamische API-Basisauflösung
- `src/services/api.ts`: API-Basis wird jetzt zur Laufzeit bestimmt:
  1. `VITE_BACKEND_URL` (falls gesetzt) hat Vorrang.
  2. Falls `window.location.port` 5173/4173 (Dev-Ports) ist, wird `http://{hostname}:8000/api/v1` genutzt.
  3. Sonst gleiche Origin (`/api/v1`).
- Ergebnis: Browser spricht den Backend-Host, der von außen erreichbar ist; Strategien laden wieder.

### Fix 2: Fehler-Sichtbarkeit
- `src/store/fleetStore.ts`: Auth-Fehler bei Agent-Fetch führen zu Logout + sichtbarer Fehlermeldung.
- `DeployAgentModal.tsx`: Zeigt Fehlertext beim Laden der Strategien.

### Fix 3: UI/Modal-Layout
- `DeployAgentModal.css`: Breiteres Modal, flexibles Grid (minmax), Dropdown-Breite/Z-Index gefixt → kein Overflow mehr.

### Fix 4: Deployment
- Frontend-Image neu gebaut (`docker compose build frontend`) und Container neu gestartet (`docker compose up -d frontend`).

---

## 5. STATUS

- Strategien erscheinen im DeployAgent-Modal wieder.
- Modal-Layout bleibt innerhalb des Viewports.
- API-Aufrufe laufen im Browser gegen den erreichbaren Backend-Host.

---

*Dokument Version: 2.1*
*Letzte Aktualisierung: 2025-12-08 22:45*
