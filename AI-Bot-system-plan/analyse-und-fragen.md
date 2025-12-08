# AI Trading Bot - Analyse & Offene Fragen

**Erstellt:** 2025-12-08  
**Von:** Antigravity (AI Assistant)  
**Zweck:** Klärung vor Implementation

---

## 1. Mein Verständnis des Ziels

Ihr wollt einen **"Glass Box" AI Trading Supervisor** bauen:

| Feature | Beschreibung |
|---------|--------------|
| **Visual Debugging** | Bot zeichnet Ideen in Chart (Trendlinien, Entry/SL/TP) |
| **Human-in-the-Loop** | User muss "GO" drücken bevor gehandelt wird |
| **Multi-Pair Fleet** | Mehrere Bots parallel (BTC, SOL, ETH...) |
| **Profit Skimming** | Automatisches Abschöpfen von Gewinnen |
| **Chat-Interface** | Mit dem Bot über Entscheidungen diskutieren |

---

## 2. Was bereits existiert (aktueller Stack)

| Feature | Status | Komponente |
|---------|--------|------------|
| KlineCharts | ✅ | `KlineChartCore.tsx` |
| Drawing Tools | ✅ | `DrawingToolbar.tsx` |
| Strategy Builder | ✅ | Pine Script → Python Transpiler |
| Paper Trading | ✅ | `PaperTradingService` |
| WebSocket Live Data | ✅ | Binance Integration |
| Order Book | ✅ | `paper_orders` Tabelle |
| AI Chat | ✅ | Research Agent + Gemini |

---

## 3. Was noch fehlt

### Backend
- [ ] `trading_agents` Tabelle (DB-Migration)
- [ ] `TradingSupervisor` Klasse (Python asyncio Worker)
- [ ] `AgentFleetManager` Service
- [ ] WebSocket-Kanal für Agent-Status
- [ ] Profit Skimming Logic

### Frontend
- [ ] "Mission Control" Dashboard
- [ ] Agent Detail View (Chart + Log + Chat)
- [ ] Custom Overlays für "Ghost Lines"
- [ ] "Deploy Agent" Wizard
- [ ] Order Source Tag im Orderbuch

---

## 4. Offene Fragen

### Frage 1: Execution Mode
**Soll der Bot nur Paper Trading machen, oder auch echte Binance-Orders?**

> 📝 **Deine Antwort:**  
> _________________________________________________  
> _________________________________________________

**Kontext:** Echte Orders haben massive Security-Implikationen (API Key Handling, Rate Limits, Withdrawal Protection).

---

### Frage 2: Gemini Integration
**Soll der Bot selbständig Gemini anfragen für Entscheidungen, oder nur die gespeicherten Python-Strategien ausführen?**

> 📝 **Deine Antwort:**  
> _________________________________________________  
> _________________________________________________

**Kontext:** LLM-Anfragen in Echtzeit haben Halluzinations-Risiko. Alternativ: Nur vordefinierte Python-Logik ausführen.

---

### Frage 3: Persistenz der Bot-Zeichnungen
**Sollen die "Ghost Lines" (Vorschläge) in der DB gespeichert werden, oder nur live über WebSocket?**

> 📝 **Deine Antwort:**  
> _________________________________________________  
> _________________________________________________

**Optionen:**
- **Live only:** Einfacher, aber Zeichnungen verschwinden bei Page Reload
- **DB:** Komplexer, aber History und Replay möglich

---

### Frage 4: Kill Switch Schwellwert
**Im Brainstorm steht "10% Budget-Verlust = Auto-Stop". Ist das fix oder soll der User das einstellen können?**

> 📝 **Deine Antwort:**  
> _________________________________________________  
> _________________________________________________

**Beispiel:** User könnte wählen: 5%, 10%, 15%, oder "Kein Limit"

---

### Frage 5: Priorität
**Womit anfangen?**

> 📝 **Deine Antwort (A, B, oder C):**  
> _________________________________________________

| Option | Beschreibung | Pro | Contra |
|--------|--------------|-----|--------|
| **A** | Backend-First (DB + TradingSupervisor) | Solide Basis | UI erst spät sichtbar |
| **B** | Frontend-First (Mission Control Mockup) | Schnell visuell | Backend muss nachziehen |
| **C** | Integration-First (Ein einfacher Bot) | End-to-End Proof | Weniger skalierbar |

---

### Frage 6: Profit Skimming Details
**Wie genau soll das Abschöpfen funktionieren?**

> 📝 **Deine Antwort:**  
> _________________________________________________  
> _________________________________________________

**Beispiel-Optionen:**
- 50% jedes Gewinns → Reserve
- Nur Gewinne über X% → Reserve
- User definiert den Prozentsatz

---

### Frage 7: Multi-Timeframe Konfiguration
**Welche Timeframe-Kombinationen sollen möglich sein?**

> 📝 **Deine Antwort:**  
> _________________________________________________  
> _________________________________________________

**Beispiele:**
- Macro: 4h, 1d | Micro: 5m, 15m
- Oder frei wählbar?

---

## 5. Nächste Schritte

Sobald du die Fragen beantwortet hast:

1. Ich erstelle einen **detaillierten Implementation Plan**
2. Mit konkreten **Tasks und Zeitschätzungen**
3. Basierend auf **unserem aktuellen Tech-Stack**

---

**Bitte fülle die Antwortfelder aus und gib mir Bescheid!** 👇
