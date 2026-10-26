# Roadmap

Jede Phase beginnt mit einem Plan, den Gianluca freigibt, und endet mit einem Abschnitt „Annahmen ohne Rückfrage / verworfene Alternativen“ in dieser Datei.

## Abnahme, die für jede Phase ab 1 gilt

- Spiellogik ist von der Oberfläche getrennt (`src/engine/`) und hat automatische Tests, mindestens alle Fälle der Gegenprüfung (SPEC 14.2), die diese Phase betreffen.
- Alle Tests laufen grün; die Testausgabe wird Gianluca gezeigt.
- Checkout-Vorschläge werden gegen die vollständige Liste aller Reste 2–170 getestet.
- Ein automatisierter Durchlauf in Handygröße (iPhone und Android, Hoch- und Querformat) spielt ein ganzes Leg.
- Gianluca hat die App auf einem iPhone und einem Android-Gerät installiert und die Phase am Board getestet.

---

## Phase 0 – Spezifikation

- [x] Referenzen gelesen, Rückfragen geklärt
- [x] iPhone-PWA-Annahme an WebKit-Doku geprüft (SPEC 13.1)
- [x] SPEC.md, ROADMAP.md, CLAUDE.md
- [x] **Freigabe durch Gianluca** (25.10.2026)

## Phase 1 – Grundgerüst

- Projekt anlegen (Vite, TypeScript, Preact, Vitest, Playwright), Git-Repository
- Ereignisspeicher (IndexedDB/Dexie), `persist()`-Anfrage, Fortsetzen nach Neustart
- Profile anlegen, umbenennen, archivieren; Gastspieler
- X01 komplett: Startwerte, In/Out, Legs/Sets, Bust-Regeln
- Board-Eingabe mit Ring-Leiste neben dem Finger, Daneben-Ring und -Knopf
- Pills, Rechenzeile, Weiter, Rückgängig, Runde bearbeiten
- Checkout-Vorschläge Experte/Einsteiger/Aus, Golden-Liste 2–170 zum Gegenlesen
- Export und Import (nur hinzufügend), Sicherungs-Erinnerung
- PWA: installierbar, offline, Update-Hinweis zwischen Spielen
- Veröffentlichung auf GitHub Pages über GitHub Actions
- Repository: `Wealthgatepilot/dartsapp` (öffentlich), App: https://wealthgatepilot.github.io/dartsapp/

**Stand Phase 1 (25.10.2026)**

- [x] Haltepunkt 1: Board-Prototyp am Handy getestet (Zugweite 50 px, Safari-Querformat repariert)
- [x] Haltepunkt 2: X01-Spiellogik mit Tests
- [x] Haltepunkt 3: Checkout-Tabelle freigegeben (inkl. zweitem Weg ohne Bull)
- [x] Speicher, Bildschirme, Export/Import, Installierbarkeit, Offline
- [x] Playwright spielt ein ganzes Leg in 5 Handy-Varianten; Offline-Start geprüft (Chromium)
- [x] **Haltepunkt 4: Test am Board auf iPhone und Android** (`docs/PRUEFLISTE-PHASE1.md`) – laut Gianluca alles in Ordnung (25.10.2026)

**Phase 1 abgeschlossen am 25.10.2026.**

**Annahmen ohne Rückfrage (Phase 1)**

1. „Weiter“ nach weniger als 3 Darts füllt mit Fehlwürfen auf; Rückgängig nimmt beides zusammen zurück (SPEC 3.4).
2. Die Position eines Darts (Leg, Spieler, Aufnahme, Dart) ist maßgeblich, nicht die Uhrzeit (SPEC 3.4, 3.5).
3. „Runde bearbeiten“ fragt nur nach, wenn sich Bust oder Checkout ändert oder spätere Darts verworfen werden.
4. Ein Dart der laufenden Aufnahme lässt sich per Pill ohne Rückfrage entfernen.
5. Solange „Weiter“ fehlt, ist das Board gesperrt.
6. Profilnamen: höchstens 30 Zeichen, eindeutig ohne Rücksicht auf Groß-/Kleinschreibung. Gäste ohne Namen heißen „Gast 1“, „Gast 2“ …
7. Das X01-Setup merkt sich die letzten Einstellungen und Spieler.
8. „Revanche“ übernimmt Spieler, Reihenfolge und Einstellungen unverändert.
9. Der Average im Spiel ist der laufende Average über alle bisherigen Darts des Matches.
10. Teilen-Menü für die Sicherung nur auf Touch-Geräten, am Rechner Download.
11. Vor einem Import muss der aktuelle Stand gesichert werden (entfällt bei leerem Speicher).
12. Sicherungs-Erinnerung erst, wenn es mindestens ein beendetes Spiel gibt.
13. Neue App-Versionen werden nur auf der Startseite angeboten; die App sucht stündlich nach Updates.
14. „App installieren“-Hinweis lässt sich pro Gerät ausblenden (Browser-Speicher, reine Bequemlichkeit).
15. Der Ordner `referenz/` wird nicht hochgeladen (fremde Apps, private Wohnung, öffentliches Repository).
16. Offline-Test automatisch nur in Chromium; auf dem iPhone deckt das der Gerätetest ab.
17. App-Symbol: eigenes, schlichtes Board ohne Beschriftung.

**Verworfene Alternativen (Phase 1)**

| Alternative | Warum verworfen |
|---|---|
| Darts nach Uhrzeit ordnen | Bearbeitete Runden hätten spätere Darts in falsche Aufnahmen verschoben. |
| Starre Rangfolge für Checkouts | Ergab unübliche Wege (64 → T20 D2); Kostenmodell trifft die Profi-Tabelle besser. |
| Zweiter Checkout-Weg bei „fast gleich gut“ | 60–100 Zeilen mit vertauschten Darts, unruhig am Board. |
| Automatisches Update der App | Könnte mitten im Spiel neu laden. |
| Fertige Router-Bibliothek | Fünf Bildschirme brauchen nur eine kleine eigene Navigation über `#`. |
| Spielstand zusätzlich speichern | Würde von den Darts abweichen können; er wird immer berechnet. |
| Board-Größe über „100 % des Kastens“ | Safari auf dem iPhone machte im Querformat 0 daraus. |

## Phase 2 – Weitere Kernmodi und Statistik

- Cricket (Standard, Cut-Throat, freie Zielzahlen, Trefferzahl)
- Shanghai
- Doppelfeld-Training mit Treffer/Falsch-Eingabe
- Ausbullen und Münzwurf
- Regelerklärung je Modus nach Einstellungen
- Langzeitstatistik je Profil und Modus: Verlaufsdiagramm, Heatmap, Doppelquote je Feld
- Bestleistungs-Vergleich im laufenden Spiel

**Stand Phase 2 (26.10.2026)**

- [x] Gemeinsames Gerüst für alle Modi; gespeicherte X01-Spiele ergeben vorher und nachher denselben Stand
- [x] Cricket mit Tests G21–G30 – **Haltepunkt A:** am Board gespielt, in Ordnung
- [x] Shanghai mit Tests G31–G33, dazu die Frage „Spiel beenden oder weiterspielen?“
- [x] Doppelfeld-Training mit Tests G34–G35, Ziele frei wählbar
- [x] Wer beginnt: Ausbullen (mit Zoom hinein und heraus), Münzwurf, wie eingetragen
- [x] Regelerklärung je Modus passend zu den Einstellungen
- [x] Statistik-Rechnung – **Haltepunkt B:** Zahlen am Beispiel geprüft (`docs/STATISTIK-BEISPIEL.md`)
- [x] Statistik-Bildschirm: Verlauf, Heatmap, Doppelquote je Feld, Aufnahmen 80+ … 180
- [x] Bestleistungs-Vergleich im Spiel (🏆)
- [x] Zusätzlich gewünscht: Leg-Übersicht mit Average je Leg, kein Browser-Zoom in der Spielansicht
- [x] Handy-Tests für alle Modi in 5 Varianten; 210 Unit-Tests, 89 Handy-Tests grün
- [x] **Haltepunkt C: Test am Board auf iPhone und Android** (`docs/PRUEFLISTE-PHASE2.md`) – Rückmeldungen umgesetzt (Spielstand ganz sichtbar, graue Zahlen gesperrt, Shanghai-Rückgängig, Training-Tabelle ohne Scrollen, 80+ je Leg, Heatmap als Wärmebild), danach laut Gianluca alles in Ordnung (26.10.2026)

**Phase 2 abgeschlossen am 26.10.2026.**

**Bekanntes Problem (nicht in der App):** Auf einem Xiaomi-Handy von Gianluca melden Chrome und Firefox „bereits installiert“, obwohl keine App zu finden ist. Bei Nuzlocke passiert dasselbe, seit das Symbol beim Verschieben verschwand. Ausgeschlossen: Überschneidung mit anderen Apps, Website-Daten, Startbildschirm-Daten, neue App-Kennung. Vermutlich hängt eine halb installierte Web-App im System. Vorerst wird Darts dort im Chrome-Tab benutzt (gleiche Daten wie eine installierte App).

**Annahmen ohne Rückfrage (Phase 2)**

1. Alle Modi mit Aufnahmen teilen sich Weiter, Rückgängig, Runde bearbeiten und Spielende; jeder Modus liefert nur seine Regeln.
2. Im Doppelfeld-Training gibt es kein „Runde bearbeiten“; Rückgängig genügt bei Treffer/Falsch.
3. Shanghai: Rückgängig nimmt zuerst die Antwort auf die Shanghai-Frage zurück, dann den Dart.
4. Revanche mit Ausbullen oder Münzwurf lost die Reihenfolge neu aus; sonst bleibt sie gleich.
5. Ausbullen: Der Punkt zählt erst mit „Wurf bestätigen“; ein Doppeltipp über zwei Würfe hinweg zählt nicht als Zoom.
6. Statistik-Übersicht und Verlauf zeigen nur abgeschlossene Legs; Quoten nutzen weiter alle Darts (SPEC 11.1).
7. Gleitender Durchschnitt über die letzten 10 Werte; Zeitraum „alles“ als Standard, die Wahl wird je Gerät gemerkt.
8. Heatmap als Wärmebild: blau = selten, weiß = mittel, rot = oft (Wunsch Gianluca); Felder ohne Darts bleiben dunkel.
9. Aufnahmen 80+ … 180 in der Langzeitstatistik als Summe, Schnitt je Leg und bestes Leg.
10. Der Bestleistungs-Knopf 🏆 sitzt in der Kopfzeile aller Spielansichten.
11. Die Leg-Übersicht erscheint ab dem zweiten Leg und zeigt das laufende Leg mit dem bisherigen Stand.
12. In der Spielansicht ist das Zoomen mit zwei Fingern abgefangen (iPad hielt sich nicht an die Viewport-Angabe).
13. Das Manifest hat eine feste App-Kennung `/dartsapp/` (gleich dem bisherigen Standardwert).
14. Spielansicht im Hochformat: Die Anzeige oben ist so hoch wie nötig, das Board füllt den Rest; Mindestgröße 68 % der Breite (Cricket kleiner, damit die Tafel passt). Rechenzeile und Checkout-Vorschlag teilen sich eine Zeile fester Höhe.
15. Der Knopf zur Leg-Übersicht („Legs“) sitzt in der Kopfzeile, damit er immer sichtbar ist.
16. Training-Ergebnis: bei mehr als 6 Feldern in bis zu drei Teilen; im Hochformat untereinander wie eine Tabelle, im Querformat nebeneinander.

**Verworfene Alternativen (Phase 2)**

| Alternative | Warum verworfen |
|---|---|
| Jeder Modus mit eigenem Ablauf | Weiter, Rückgängig und Runde bearbeiten mehrfach geschrieben, Fehler mehrfach möglich. |
| Diagramm-Bibliothek (z. B. Chart.js) | Macht die App größer; ein Verlauf und eine Heatmap gehen schlicht als SVG. |
| Board-Eingabe im Doppelfeld-Training | Treffer/Falsch ist am Board schneller; das Feld steht ohnehin fest. |
| „Shanghai beendet das Spiel“ nur als feste Einstellung | Gianluca möchte nach jedem Shanghai selbst entscheiden. |
| Aufnahmen 80+ nur als Schnitt je Leg („0,5 Aufnahmen“) | Missverständlich; Summe, Schnitt und bestes Leg nebeneinander sind klarer. |
| Neue App-Kennung gegen „bereits installiert“ | Half auf dem Xiaomi-Handy nicht; die Ursache liegt am Gerät. Zurückgenommen. |
| Graue Zahlen antippbar lassen | Vertipper zwischen Zielzahlen trugen falsche Felder ein; Gianluca hat sich für Sperren entschieden (Heatmap zeigt solche Darts als „Daneben“). |
| Feste Board-Größe mit festem Platz darüber | Spielstand wurde abgeschnitten, sobald Checkout-Vorschlag oder Darts dazukamen. |
| Heatmap in einer Farbe (erst blau, dann rot) | Gianluca wünscht ein Wärmebild: blau – weiß – rot. |

**Ideen für später (Optik und Komfort, nach der Funktion)**

- Kompaktere Spielansicht für kleine Handys, damit das Board größer wird.
- Optik verfeinern (Phase 3): Farben, Übergänge, Spielende-Bildschirm.

## Phase 3 – Weitere Modi und Komfort

- Around the Clock, Killer, 121, Bob's 27, Halve-It, Count-Up
- Handicap über Startwerte
- Sprachausgabe
- Computergegner Stufe 1–10 (Kalibrierung per Simulation)
- Optik verfeinern

**Plan Phase 3 (freigegeben 26.10.2026)**

1. Count-Up und Handicap bei X01
2. Around the Clock
3. Bob's 27
4. Halve-It – **Haltepunkt D:** Gianluca spielt die vier Modi und Handicap am Board
5. 121
6. Killer
7. Statistik und Bestleistung für die neuen Modi
8. Computergegner mit Simulation der Stufen – **Haltepunkt E:** Stufen-Tabelle und Spiel gegen den Computer
9. Sprachausgabe
10. Optik: nur Vorschläge zur Auswahl; „lassen wir erst einmal so“ ist ausdrücklich möglich (Wunsch Gianluca) – **Haltepunkt F**
11. Handy-Tests, ROADMAP – **Haltepunkt G:** Test am Board auf iPhone und Android

**Stand Phase 3 (26.10.2026)**

- [x] Count-Up (G39–G40), Handicap bei X01 (G41)
- [x] Varianten in jeder Regelansicht (Wunsch Gianluca)
- [x] Around the Clock (G42–G44)
- [x] Bob's 27 (G45–G47), Treffer zählen in die Doppelquote aus dem Training
- [x] Halve-It (G48–G51)
- [x] Statistik und Bestleistung für die vier neuen Modi gleich mit eingebaut
- [ ] **Haltepunkt D** (`docs/PRUEFLISTE-HALTEPUNKT-D.md`)

Annahmen aus dem Plan: Computer in allen Modi (bei Killer „selbst wählen“ bekommt er eine zufällige freie Zahl); in Treffer/Falsch-Modi zielt er auf das Double und das Board entscheidet; Spiele gegen den Computer zählen fürs Profil, sind in der Statistik filterbar; Killer „selbst wählen“: Zahl vor dem Start auf dem Board antippen, keine doppelt; Sprachausgabe standardmäßig an, „Game Shot“ englisch; Handicap nur bei X01.

## Phase 4 – Turnier

- K.-o. mit Freilosen, Jeder gegen jeden, Gruppen + K.-o.
- Turnierbaum und Tabellen

## Phase 5 – Daten mehrerer Geräte

- Import mit Zusammenführen, Profile verknüpfen (`profile.linked`)
- Danach Entscheidung durch Gianluca, ob echte Synchronisation (z. B. Supabase) kommt
