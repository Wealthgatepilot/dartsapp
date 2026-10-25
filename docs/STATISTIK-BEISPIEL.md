# Statistik-Beispiel zum Prüfen (Haltepunkt B)

Alle Zahlen unten hat die App aus den Darts berechnet. Jede Zeile ist zusätzlich ein automatischer Test (`tests/engine/metrics.test.ts`).
Bitte prüfen: Stimmen die Zahlen mit dem, was du am Board erwarten würdest?

## 1. X01: 501 Double-Out, ein Leg von Gian

| Aufnahme | Darts | Punkte | Rest danach | Double-Versuche in dieser Aufnahme |
|---:|---|---:|---:|---|
| 1 | T20 T20 T20 | 180 | 321 | – |
| 2 | T20 T19 S20 | 137 | 184 | – |
| 3 | T20 S1 T20 | 121 | 63 | – |
| 4 | S13 S10 S10 | 33 | 30 | Rest 50 → Bull verfehlt, Rest 40 → D20 verfehlt |
| 5 | S10 D10 | 30 | 0 ✔ | Rest 30 → D15 verfehlt, Rest 20 → D10 **getroffen** |

| Kennzahl | Formel | Ergebnis |
|---|---|---:|
| Geworfene Darts | 3 + 3 + 3 + 3 + 2 | **14** |
| 3-Dart-Average | 501 / 14 × 3 | **107,36** |
| First-9-Average | (180 + 137 + 121) / 9 × 3 | **146,00** |
| Double-Versuche | Bull, D20, D15, D10 | **4** |
| Double-Out-Quote | 1 / 4 × 100 | **25,0 %** |
| Darts bis zum Finish | – | **14** |
| Höchster Checkout | Rest zu Beginn der Checkout-Aufnahme | **30** |
| Aufnahmen 180 | Aufnahme 1 | **1** |
| Aufnahmen 120–139 | Aufnahmen 2 und 3 | **2** |
| Aufnahmen 80–99, 100–119, 140–159, 160–179 | – | **0** |
| Stand nach 9 Darts: Average | 438 / 9 × 3 | **146,00** |

**Sonderfälle:**
- **Bust:** Bei Rest 32 wirft Gian S20 und dann T20. Das sind 2 Darts mit 0 Punkten und 2 Double-Versuche (D16 bei Rest 32, D6 bei Rest 12), beide verfehlt.
- **Kein Double-Versuch:** Rest 41, 42, 60 oder 1 sowie jeder Rest bei Single-Out.

## 2. Bestleistungs-Vergleich (zweites Leg, 3 × 60 = 9 Darts, noch offen)

| Kennzahl | Aktuell | Rekord | Abweichung |
|---|---:|---:|---:|
| 3-Dart-Average, **Endwert** | 60,00 | 107,36 (Leg oben) | **−44,1 %** |
| 3-Dart-Average, **nach 9 Darts** | 60,00 | 146,00 (Leg oben nach 9 Darts) | **−58,9 %** |
| Darts bis zum Finish | – | 14 | (erst am Ende) |

Das offene Leg zählt nie als Rekord, nur abgeschlossene Legs.

## 3. Cricket (Standard, 15–20 + Bull)

Aufnahme von Gian: **T20 T20 S19**, Jörn hat 20 noch offen.

| Kennzahl | Formel | Ergebnis |
|---|---|---:|
| Zählende Marks | 3 (20 zu) + 3 (bringen 60 Punkte) + 1 (19) | **7** |
| Marks pro 3 Darts | 7 / 3 × 3 | **7,00** |
| Punkte | 3 überzählige Marks × 20 | **60** |
| Nach 1 Dart | 3 Marks in 1 Dart | MPR **9,00**, Punkte **0** |

## 4. Shanghai (Start 1, 2 Runden)

Runde 1 (Ziel 1): **S1 D1 T1** = Shanghai, „Weiterspielen“. Runde 2 (Ziel 2): **T2 0 0**.

| Kennzahl | Formel | Ergebnis |
|---|---|---:|
| Marks | (1 + 2 + 3) + 3 | **9** |
| Marks pro 3 Darts | 9 / 6 × 3 | **4,50** |
| Endpunkte | 1 + 2 + 3 + 6 | **12** |
| Schnellstes Shanghai | nach Dart 3, auf der 1 | **3 Darts (Feld 1)** |

## 5. Doppelquote je Feld (Training und X01 zusammen)

Training nur auf D10: Falsch, Falsch, Treffer. Dazu das X01-Leg oben (ein Versuch auf D10, getroffen).

| Feld | Training | X01 | Zusammen |
|---|---|---|---|
| D10 | 1 / 3 (33,3 %) | 1 / 1 (100 %) | **2 / 4 (50,0 %)** |
| DB | – | 0 / 1 | 0 / 1 |

## 6. Heatmap

Gezählt werden nur Darts, die über das Board eingegeben wurden. Aufgefüllte Fehlwürfe nach „Weiter“ und Training-Eingaben zählen nicht.
Im X01-Leg oben: T20 × 6, S10 × 3, T19, S20, S1, S13, D10 je × 1, zusammen 14 Darts.
