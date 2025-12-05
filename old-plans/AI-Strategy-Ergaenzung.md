# **Technische Spezifikation: AI-Strategy Engine & Open Source Charting**

Ziel: Vollständige Unabhängigkeit von proprietären Bibliotheken (TradingView) und Implementierung einer KI-gestützten Übersetzung von Trading-Strategien.  
Priorität: Hoch.

## **🛑 0\. SICHERHEITSPROTOKOLL: BESTANDSSCHUTZ (WICHTIG\!)**

ANWEISUNG AN DAS ENTWICKLER-TEAM:  
Die bestehende Plattform läuft stabil (Login, Auth, Paper Trading, Datenbank). Diese Erweiterung darf KEINE Regressionen in bestehenden Modulen verursachen.  
**Unantastbare Module ("No-Go Areas"):**

1. **Authentication & User Management:** (backend/auth/\*, frontend/src/context/AuthContext). Darf nicht modifiziert werden.  
2. **Order Execution & Paper Trading Logic:** (backend/trading/\*). Die Logik, wie Orders ausgeführt werden, bleibt identisch. Die neue Engine liefert nur Signale *an* dieses System.  
3. **Database Schema (Core):** Bestehende Tabellen (users, paper\_orders) bleiben unverändert. Neue Felder nur additiv hinzufügen.

**Isolations-Strategie:**

* Arbeitet ausschließlich in neuen Dateien/Ordnern, wo möglich.  
* Benutzt Feature-Flags oder neue Routen (/api/v2/...), um bestehende APIs nicht zu brechen.  
* Der neue "Strategy Builder" ist ein **in sich geschlossenes Modul**. Er ersetzt keine globale Logik, sondern nur die UI-Komponente des Editors.

## **1\. Strategie: Pine Script Transpilation via AI (LLM)**

Anstatt einen eigenen Parser für Pine Script zu schreiben (was extrem fehleranfällig und wartungsintensiv ist), nutzen wir das im System integrierte LLM (Gemini/AI Sentinel) als **Transpiler**.

### **Der Workflow**

1. **Input:** User schreibt Pine Script im Frontend Editor.  
2. **Process:** Das Backend sendet diesen Code \+ System-Prompt an den AI Service.  
3. **Output:** Die AI liefert validen Python-Code zurück, der auf unserer internen StrategyEngine basiert (Pandas).  
4. **Execution:** Dieser Code wird in einer isolierten Umgebung (exec()) ausgeführt.

### **Warum dieser Ansatz?**

* **Wartung:** Wenn Pine Script neue Funktionen bekommt, weiß die KI das (durch Training), wir müssen keinen Parser updaten.  
* **Flexibilität:** Die KI kann auch logische Fehler im User-Skript erkennen und korrigieren.

## **2\. Implementierung: Der Python-Transpiler (Backend)**

Dieses Modul ist das Herzstück der Strategie-Engine. Es muss vom Backend-Team implementiert werden.  
Es darf keine bestehenden ccxt oder order\_manager Logiken überschreiben.  
**Datei:** backend/services/ai\_transpiler.py (NEUE DATEI)

import google.generativeai as genai  
import os  
import re

\# Konfiguration (API Key kommt sicher aus den VaultKeys)  
\# In Production: via Dependency Injection injecten  
API\_KEY \= os.getenv("GOOGLE\_API\_KEY")  
genai.configure(api\_key=API\_KEY)

class PineToPythonTranspiler:  
    def \_\_init\_\_(self, model\_name="gemini-2.0-flash"):  
        self.model \= genai.GenerativeModel(model\_name)

    def transpile(self, pine\_script\_code: str) \-\> str:  
        """  
        Übersetzt Pine Script in executable Python Code für unsere Engine.  
        """  
          
        system\_prompt \= """  
        Du bist ein Expert Coding Assistant spezialisiert auf Algorithmic Trading.  
        Deine Aufgabe: Übersetze den folgenden TradingView Pine Script Code (v5) in Python.  
          
        REGELN FÜR DEN PYTHON CODE:  
        1\. Nutze KEINE externen Libraries außer 'pandas' und 'numpy'.  
        2\. VERBOTE: Benutze NICHT 'pandas\_ta'. Nutze native Pandas Berechnungen (rolling, ewm).  
        3\. Der Code muss eine Funktion 'calculate(df: pd.DataFrame) \-\> pd.DataFrame' enthalten.  
        4\. Die Funktion muss Spalten zum DataFrame hinzufügen:  
           \- 'signal\_long': Boolean (True für Entry Long)  
           \- 'signal\_short': Boolean (True für Entry Short)  
           \- 'stop\_loss': Float (Preis)  
           \- 'take\_profit': Float (Preis)  
        5\. Gib NUR den Python-Code zurück, kein Markdown, keine Erklärungen.  
        6\. Füge Kommentare hinzu, die erklären, welche Pine-Logik wo umgesetzt wurde.  
          
        Beispiel für EMA Berechnung in Pandas:  
        df\['ema\_200'\] \= df\['close'\].ewm(span=200, adjust=False).mean()  
        """

        try:  
            response \= self.model.generate\_content(  
                f"{system\_prompt}\\n\\nINPUT PINE SCRIPT:\\n{pine\_script\_code}"  
            )  
              
            \# Cleaning: Entferne Markdown Code-Blöcke falls vorhanden  
            clean\_code \= self.clean\_response(response.text)  
            return clean\_code  
              
        except Exception as e:  
            \# Fallback oder Error Handling  
            print(f"Transpilation Error: {e}")  
            raise e

    def clean\_response(self, text: str) \-\> str:  
        \# Entfernt \`\`\`python und \`\`\` am Ende  
        text \= re.sub(r'^\`\`\`python\\n', '', text, flags=re.MULTILINE)  
        text \= re.sub(r'^\`\`\`\\n', '', text, flags=re.MULTILINE)  
        text \= re.sub(r'\`\`\`$', '', text, flags=re.MULTILINE)  
        return text.strip()

\# \--- Integrationstest (Pseudo-Code) \---  
if \_\_name\_\_ \== "\_\_main\_\_":  
    transpiler \= PineToPythonTranspiler()  
    pine\_code \= """  
    //@version=5  
    strategy("My Strategy", overlay=true)  
    rsiVal \= ta.rsi(close, 14\)  
    if (rsiVal \< 30\)  
        strategy.entry("Long", strategy.long)  
    """  
    python\_code \= transpiler.transpile(pine\_code)  
    print(python\_code)

## **3\. Charting: Open Source & High Performance**

**WICHTIG:** Das Ersetzen der Charts darf **NICHT** den Datenfeed (WebSockets) im Backend beeinflussen. Der Datenfluss bleibt gleich, nur die *Darstellung* im Frontend ändert sich.

Empfohlene Technologie: Apache ECharts (oder D3.js, da bereits im Stack).  
Grund: ECharts ist Canvas-basiert (extrem schnell bei 10.000+ Kerzen), unterstützt Zoom/Pan nativ und ist lizenzkostenfrei (Apache 2.0).

### **Anforderungen an das Frontend-Team:**

1. **Chart Engine:** Erstellt eine **neue Komponente** OpenSourceChart.tsx. Löscht die alte TradingViewWidget.tsx erst, wenn die neue Komponente fehlerfrei läuft.  
2. **Custom Overlays (Fair Value Gaps):**  
   * Das Backend liefert FVG-Zonen als JSON: \[{start: "10:00", end: "12:00", high: 50000, low: 49000, type: "bullish"}\].  
   * Das Frontend muss diese Zonen als halb-transparente Rechtecke (rect) direkt in den Canvas zeichnen.  
   * *Vorteil:* Da wir Open Source nutzen, haben wir Zugriff auf den Render-Loop und können beliebige Formen (Gaps, Trendlinien) einzeichnen.  
3. **Drawing Tools (Trendlinien):**  
   * Implementierung einer eigenen Maus-Interaktions-Logik.  
   * Beim Klick auf den Chart werden die Koordinaten (x, y) in (Zeit, Preis) umgerechnet und eine Linie gezeichnet.

### **Datenstruktur für Visualisierung**

Das Backend sendet ein einheitliches JSON-Format für alle visuellen Elemente:

{  
  "candles": \[ ...OHLCV Daten... \],  
  "overlays": {  
    "indicators": \[   
       {"name": "SMA\_20", "data": \[ ...Werte... \], "color": "blue"}   
    \],  
    "shapes": \[  
       {"type": "box", "label": "Bullish FVG", "y1": 49000, "y2": 50000, "x1": 16788800, "x2": 16789900, "color": "rgba(0,255,0,0.2)"}  
    \]  
  }  
}

## **4\. Zusammenfassung & Abgrenzung**

1. **Backend:** Implementiert PineToPythonTranspiler Klasse unter Nutzung der Gemini API. **Keine Änderungen an Auth oder Trading Core.**  
2. **Frontend:** Baut das Charting auf **Apache ECharts** oder **D3.js** auf. **Alte Chart-Komponente bleibt als Backup vorerst im Code.**  
3. **Features:** Fair Value Gaps und Trendlinien werden als Custom Shapes auf den Open Source Chart gerendert.

## **5\. UX/UI Implementation: Der "No-Copy-Paste" Workflow**

Dieser Abschnitt beschreibt, wo und wie der generierte Python-Code im Strategy Builder (Frontend) platziert wird.  
Änderung betrifft nur die Seite /strategy-builder. Alle anderen Seiten bleiben unberührt.  
Problem: Der User darf den von der AI generierten Python-Code nicht manuell kopieren müssen.  
Lösung: "Auto-Injection" in einen sekundären Editor-Tab.

### **UI-Layout Anweisungen (Frontend)**

Der Bereich "Pine Script Editor" (Linke Spalte im Strategy Builder) wird erweitert zu einem **Tab-System**:

* **Tab A: "Source (Pine Script)"** (Der bestehende Editor)  
* **Tab B: "Engine (Python)"** (Neu, initial leer oder Read-Only)

### **Funktionsablauf (Step-by-Step)**

1. **Trigger:** User klickt auf einen neuen Button **"Generate Strategy Engine"** (neben "Save").  
2. **Transpilation:** Backend (AI) generiert den Python Code.  
3. **Auto-Injection (WICHTIG):**  
   * Das Frontend empfängt den Python-String.  
   * Das Frontend wechselt **automatisch** auf **Tab B (Engine)**.  
   * Der Code wird direkt in den Editor von Tab B injiziert.  
   * **Kein User-Eingriff nötig.**  
4. **Editierbarkeit:** Der User kann den Python-Code in Tab B manuell anpassen (z.B. Parameter tweaken), falls die AI einen kleinen Fehler gemacht hat.  
5. **Strategy Tester Verbindung:**  
   * Der "Strategy Tester" (Rechte Spalte / Mitte) bekommt eine interne Logik-Änderung.  
   * Wenn der User auf **"Run Backtest"** klickt, nimmt das System nun **immer** den Code aus dem **Tab B (Engine)** als Quelle für die Ausführung.  
   * Der Tab A (Pine Script) dient nur noch als "Vorlage/Referenz".

### **Speicher-Logik**

Beim Klick auf "Save Strategy" müssen **beide** Code-Fragmente in der Datenbank gespeichert werden:

* strategy.source\_code (Pine Script)  
* strategy.python\_code (Der generierte/editierte Python Code)

## **6\. Erweiterung: Indikatoren vs. Strategien (Composition)**

Um Verwirrung zu vermeiden, müssen wir technisch strikt zwischen "Indikator" (Reine Berechnung) und "Strategie" (Handelssignale) unterscheiden.

### **6.1 Datenmodell-Erweiterung (Type Separation)**

Beim Speichern oder Erstellen muss der Typ explizit gesetzt werden:

* **Type INDICATOR**:  
  * Output: Eine numerische Serie (z.B. RSI-Kurve, MACD-Histogramm).  
  * Verhalten im Tester: Kann **NICHT** alleine gebacktestet werden (da keine Kauf-Signale existieren).  
  * UI: Kann nur "auf den Chart gelegt" werden.  
* **Type STRATEGY**:  
  * Output: signal\_long / signal\_short Booleans \+ StopLoss/TakeProfit Preise.  
  * Verhalten im Tester: Kann gebacktestet werden (PnL, Drawdown).

### **6.2 Der "Strategy Composer" Workflow**

Das System soll erlauben, einfache Indikatoren zu einer Strategie zu verbinden, ohne Code zu schreiben (mithilfe der AI).

**User Story:**

1. User öffnet "Strategy Builder".  
2. Wählt im Menü: **"Combine Indicators"**.  
3. UI zeigt Dropdowns:  
   * Slot 1: "Wähle Indikator A" (z.B. RSI aus Datenbank)  
   * Slot 2: "Wähle Indikator B" (z.B. Bollinger Bands)  
4. User definiert Logik in Textform (Prompt): *"Kaufe wenn RSI \< 30 und Preis unter dem unteren Bollinger Band ist."*  
5. **AI Action:** Die AI generiert den Python-Code, der beide Berechnungslogiken importiert und die if/else Logik für die Signale schreibt.  
6. **Ergebnis:** Das Ganze wird als neuer Eintrag vom Typ STRATEGY gespeichert.

**Anweisung an Frontend:**

* Der "Save"-Dialog braucht einen Radio-Button: \[ \] Save as Indicator vs \[ \] Save as Strategy.  
* Wenn Indicator gewählt ist, ist der "Backtest"-Button im Tester deaktiviert (grau).