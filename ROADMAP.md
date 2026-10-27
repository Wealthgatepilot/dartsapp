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

- Kompaktere Spielansicht für kleine Handys, damit das Board größer wird – vor allem im Querformat auf dem iPhone scrollen die Spielerkarten noch ein Stück.
- 121: Statistik je Finish-Bereich (70–79 … 160–170): wie oft geschafft, im wievielten Versuch, mit wie vielen Darts (Daten werden schon gespeichert).
- Optik verfeinern (Phase 3): Farben, Übergänge, Spielende-Bildschirm.
- Schmale Zahlenschrift für die großen Zahlen (frei lizenziert, z. B. Oswald oder Bebas Neue, in der App mitgeliefert, damit sie offline geht; etwa eine Stunde Arbeit).
- Spielerblöcke auch in Count-Up, 121 und den übrigen Modi, wenn sie sich bewähren.

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
- [x] **Haltepunkt D** (`docs/PRUEFLISTE-HALTEPUNKT-D.md`) – laut Gianluca alles in Ordnung (26.10.2026); Frage zu den Sprüngen bei Around the Clock geklärt
- [x] 121 (G52–G55) mit Checkout-Vorschlag und Statistik
- [x] Killer (G56–G59); keine Kennzahlen laut SPEC, daher ohne Statistik und 🏆
- [x] Statistik und Bestleistung für die neuen Modi (Schritt 7) – mit den Modi gleich eingebaut
- [x] Computergegner Stufe 1–10, eingestellt per Simulation (je 10 000 Legs), in allen Modi und beim Ausbullen; Statistik-Filter „mit/ohne Computer“
- [x] **Haltepunkt E** (`docs/PRUEFLISTE-HALTEPUNKT-E.md`) – laut Gianluca passt es (26.10.2026), dazu umgesetzt: Ausweichen bei verdeckten Zielen, menschliche Schwankungen
- [x] 121 neu (Wunsch Gianluca): zufällige Finishes 70–170, 6 bzw. 9 Darts je Versuch, Wiederholen bis geschafft, Überspringen; alte 121-Spiele bleiben lesbar (G60–G65)
- [x] Sprachausgabe (Punkte, „du brauchst“, Game Shot, Sieger), 🔊 im Spiel, Schalter in den Einstellungen
- [x] Spielverlauf mit Filtern, Rückblick je Spiel (Ergebnis, Kennzahlen, Aufnahmen) und Favoriten je Profil (Wunsch Gianluca)
- [x] Fehler behoben: Sicherungen mit 121-„Überspringen“ wären beim Import abgelehnt worden
- [x] Killer „selbst wählen“: Der Computer bekommt beim Start eine zufällige freie Zahl
- [x] GitHub-Ablauf testet im fertigen Playwright-Paket (vorher hing der Browser-Download zweimal über 40 Minuten)
- [x] Optik-Vorschläge (Haltepunkt F): Gianluca wählt Design 6 „Kreidegrau & Orange“, dazu Spielerblöcke nach seinem iPad-Foto (nur Rand für den aktiven Spieler) und flachere Treffer/Falsch-Knöpfe; das bisherige dunkle Aussehen bleibt als Schalter (SPEC 5.6); Handy und iPad von Gianluca geprüft, passt (26.10.2026)
- [x] **Haltepunkt G: Test am Board auf iPhone und Android** (`docs/PRUEFLISTE-PHASE3.md`) – laut Gianluca alles in Ordnung (26.10.2026)

**Phase 3 abgeschlossen am 26.10.2026.**

**Annahmen ohne Rückfrage (Phase 3)**

1. Jede Regelansicht erklärt alle Varianten des Modus, auch die nicht gewählten, und wie bestimmt wird, wer beginnt.
2. Startseite gegliedert in „Spiele“, „Training“ und „Mehr“, zwei Kacheln je Zeile.
3. Handicap gibt es nur bei X01; die Statistik vergleicht jeden nur mit Spielen vom selben Startwert.
4. Around the Clock: Am Bull zählt bei „nur Doubles“ und „nur Triples“ das Bullseye; Sprünge nur bei Ring „beliebig“; wer das letzte Ziel trifft, gewinnt sofort.
5. Bob's 27 und Halve-It rechnen nach dem dritten Dart ab („Weiter“ füllt auf); bei Halve-It zählt das Bullseye als beliebiges Double.
6. 121 (neu): nur mit 3 Darts checkbare Zahlen; Überspringen nur vor einer Aufnahme; Sieger nach geschafften Zahlen, dann wenigsten Darts.
7. Killer: Zahlen werden beim Start festgelegt und mit dem Spiel gespeichert; Revanche mit „zufällig“ verteilt neu; keine Kennzahlen.
8. Graue Zahlen (keine Ziele) sind in allen Modi mit Zielen gesperrt, nicht nur in Cricket und Shanghai.
9. Computer: Stufen per Simulation im Duell zweier gleich starker Computer („first to 3“), damit Druck vorkommt; in Treffer/Falsch-Modi entscheidet ein simulierter Wurf aufs Double.
10. Computer weicht verdeckten Zielen aus: Dart näher als 7 mm am Zielpunkt → T20 → T19 → T18, sonst 8 mm seitlich.
11. Menschliche Schwankungen sind standardmäßig an (Tagesform ±8 %, Streaks ±10 %, Druck beim Checken).
12. Sprachausgabe: Zahlen als Ziffern an die Stimme; nach „Weiter“ angesagt, der Sieger nur, wenn das Spiel gerade endet; an/aus je Gerät.
13. Spielverlauf: Startseite zeigt die 3 neuesten Spiele; Rückblick ohne Board; Favoriten je Profil, das letzte Ereignis zählt.
14. Optik: Kreidegrau ist Standard für alle; „Dunkel“ wird je Gerät gemerkt. Die Statusleiste auf dem iPhone bleibt durchsichtig mit heller Schrift (Umstellen würde das Layout der installierten App ändern).
15. Spielerblöcke: Die Kennzahl-Seite wechselt für alle Blöcke gemeinsam (Wischen oder Antippen). Ab drei Spielern kleinere Zahlen und nur eine Kennzahl, damit das Board groß bleibt. Training und Bob's 27 haben nur eine Seite.
16. X01-Kennzahlen im Block: Ø und Checkout-Quote über das ganze Match, Darts und First 9 im laufenden Leg, bestes Leg = wenigste Darts in einem gewonnenen Leg.
17. Treffer/Falsch: Die Blöcke füllen im Hochformat den Platz über den Knöpfen (statt einer leeren Lücke).
18. Querformat (Rückmeldung Gianluca): Tablet ab 600 Punkten Höhe – Anzeige bekommt gut 40 % der Breite, Zahlen wachsen mit der Höhe (10 % davon, höchstens 108); Handy unter 500 Punkten Höhe – Blöcke als schmale Zeilen ohne Kennzahlen.
19. Tablet quer in allen Modi (Rückmeldung Gianluca): Spielerkarten untereinander (ab drei Spielern zwei je Zeile) und so hoch, dass sie den Platz bis zur Aufnahme füllen; Cricket-Tafel mit Zeilenhöhe nach Bildschirmhöhe. Treffer/Falsch quer: Knöpfe höchstens 45 % der Breite. Handy quer bleibt ein Nebenfall (laut Gianluca nutzt das niemand).
20. Feinschliff nach Gianlucas iPad-Fotos: Cricket-Zeilen teilen sich die ganze Höhe; Zahlgröße nach Platz und Spielerzahl (ein Spieler bis 280, nie breiter als die Karte); X01-Zahl nach der wirklichen Blockhöhe; Knopfleiste 68 Punkte hoch ohne Zeilenumbruch. Geprüft in 1024×768, 1180×820, 1194×834 und 1366×1024.

**Verworfene Alternativen (Phase 3)**

| Alternative | Warum verworfen |
|---|---|
| Neues Zufalls-Training neben 121 | Gianluca wollte 121 ersetzen; alte Spiele bleiben lesbar. |
| 121: Zahl nur wiederholen, ohne Überspringen | Bei schweren Zahlen hängt man fest. |
| 121: Sieger allein nach wenigsten Darts | Überspringen wäre ein Vorteil. |
| Killer: Zahl auf dem Board antippen | Auswahl im Setup ist einfacher und vor dem Start prüfbar. |
| Stufen nur mit einzelnen Legs einstellen | Druck (Matchdart, Gegner auf Finish) käme nicht vor. |
| Eigene Double-Streuung für den Computer | Quoten liegen schon im realistischen Bereich; bei Bedarf später. |
| Browser-Download im GitHub-Ablauf mit längeren Grenzen | Hing zweimal über 40 Minuten; fertiges Playwright-Paket ist schneller und stabiler. |
| Kennzahlen im Rückblick mit Spielern als Zeilen | Bei X01 elf Spalten, zu breit fürs Handy. |
| Spielerblöcke ganz in der Spielerfarbe (wie im iPad-Foto) | Gianluca möchte nur den Rand in der Spielerfarbe, wie sonst in der App. |
| Spielerblöcke im Hochformat untereinander | Dann bliebe für das Board zu wenig Platz. |
| Design 1–5 (Klar, Anzeigetafel, Hell, Dunkel, Nardograu) | Gianluca wählt Kreidegrau; das bisherige Dunkel bleibt als Schalter. |
| Eigene schmale Zahlenschrift sofort | Erst mit Systemschrift ansehen; als Idee für später notiert. |

Annahmen aus dem Plan: Computer in allen Modi (bei Killer „selbst wählen“ bekommt er eine zufällige freie Zahl); in Treffer/Falsch-Modi zielt er auf das Double und das Board entscheidet; Spiele gegen den Computer zählen fürs Profil, sind in der Statistik filterbar; Killer „selbst wählen“: Zahl im Setup je Spieler auswählen (statt auf dem Board antippen – einfacher und vor dem Start prüfbar), keine doppelt; Sprachausgabe standardmäßig an, „Game Shot“ englisch; Handicap nur bei X01.

## Phase 4 – Turnier

- K.-o. mit Freilosen, Jeder gegen jeden, Gruppen + K.-o.
- Turnierbaum und Tabellen

**Plan Phase 4 (freigegeben 26.10.2026)**

1. SPEC Kapitel 8 ausformulieren (Ereignisse, Partie, Gleichstand, Prüffälle G66–G76)
2. Turnier-Logik ohne Oberfläche mit Tests (Auslosung, Freilose, Kreisverfahren, Gruppen, Tabelle mit 6 Regeln)
3. Turnier anlegen: Teilnehmer, Modus mit Einstellungen, Form
4. Turnier-Übersicht: Baum bzw. Tabelle und Spielplan; Partie starten, danach zurück
5. Startseite: Kachel „Turnier“, laufende fortsetzen, beendete ansehen – **Haltepunkt H:** kleines K.-o.-Turnier am Board
6. Turnierliste, Abbrechen, Statistik-Prüfung, Handy- und iPad-Tests
7. **Haltepunkt I:** Board-Test aller drei Formen auf iPhone und Android

Entscheidungen Gianluca: alle Duell-Modi (X01, Cricket, Shanghai, Count-Up, Around the Clock, Halve-It); Computer gegen Computer wird automatisch ausgespielt; Spiel um Platz 3 als Schalter (Standard aus); eigene Leg-Zahl fürs Finale. Gleichstand in einer Partie: Ausbullen.

**Stand Phase 4 (26.10.2026)**

- [x] SPEC Kapitel 8 mit Ereignissen, Partie, Gleichstand, Tabelle und Prüffällen G66–G76
- [x] Turnier-Logik (`engine/tournament.ts`): Auslosung mit Freilosen, Kreisverfahren, Gruppen mit Kreuzspielen, Tabelle mit 6 Regeln; 19 Unit-Tests
- [x] Computer gegen Computer automatisch ausgespielt (`engine/autoplay.ts`), auch das Stechen
- [x] Turnier anlegen, Übersicht mit Baum, Tabellen und Spielplan, Stechen über das vorhandene Ausbullen, Turnierliste, Kachel auf der Startseite, Turniername im Spielverlauf
- [x] Sicherung kennt die Turnier-Ereignisse; Handy-Tests für Gleichstand mit Ausbullen und ein reines Computer-Turnier
- [ ] **Haltepunkt H:** kleines K.-o.-Turnier am Board (`docs/PRUEFLISTE-HALTEPUNKT-H.md`)
- [ ] Schritt 6: Feinschliff, iPad-Ansicht, weitere Tests
- [ ] **Haltepunkt I:** Board-Test aller drei Formen auf iPhone und Android

**Annahmen ohne Rückfrage (Phase 4)**

1. Partie-Kennungen und Slots wie SPEC 8.6; ein Turnier hat höchstens 32 Teilnehmer, Gruppen 2/4/8 mit 1 oder 2 Weiterkommenden.
2. Bei Gruppen + K.-o. wird der K.-o.-Baum nicht neu gelost: A1–B2, C1–D2 … oben, B1–A2, D1–C2 … unten.
3. Freilos bei Platz 3 (nur bei 3 Teilnehmern möglich): der Halbfinal-Verlierer ist ohne Spiel Dritter.
4. Das Stechen speichert seine Würfe unter „Spiel-ID:stechen“, damit sie nicht mit dem Ausbullen vor dem Spiel zusammenfallen.
5. Ein automatisch ausgespieltes Computer-Spiel ist ein normales gespeichertes Spiel (Rückblick, Statistik); der Zufall kommt aus dem Betriebssystem.
6. Gleich heißende Teilnehmer (z. B. zwei „Computer 5“) bekommen im Turnier eine Nummer; im Spiel selbst steht der normale Name.
7. Das Turnier gilt als beendet, sobald alle Partien entschieden sind (`tournament.ended` wird dann automatisch gespeichert).

**Verworfene Alternativen (Phase 4)**

| Alternative | Warum verworfen |
|---|---|
| Auslosung und Paarungen als eigene Ereignisse speichern | Aus Zufallszahl und Teilnehmern immer gleich berechenbar; weniger, das sich widersprechen kann. |
| Nur X01 und Cricket im Turnier | Gianluca wünscht alle Duell-Modi. |
| Gleichstand per Knopf „Wer war näher?“ | Mit Computer nicht machbar; das vorhandene Ausbullen kann beides. |
| Computer-Partien Dart für Dart zuschauen | Gianluca wählt automatisches Ausspielen. |

**Rückmeldung vom Spielen: 121 mit zufälligen Zahlen (27.10.2026)**

- [x] Fehler behoben: Zwei Zahlen direkt hintereinander überspringen ging nicht (das zweite Überspringen wurde als doppelt ignoriert), deshalb ließ sich die letzte Zahl nicht überspringen. Prüffall G77.
- [x] Neu: Ist der Erste fertig, fragt die App einmal „Weiterspielen“ oder „Spiel beenden“ (SPEC 121 Regel 6, Prüffall G78).
- [x] Die Liste der checkbaren Zahlen wird nur noch einmal berechnet (121-Tests von 44 s auf unter 1 s).

Annahmen: Die Frage kommt nur einmal je Spiel, auch bei mehr als 2 Spielern; Rückgängig im Fenster nimmt den letzten Dart zurück. Beim Beenden zählen angefangene Zahlen weder als geschafft noch als übersprungen und nicht in die Statistik; nach „Weiterspielen“ zählt alles normal. Ältere Spiele, in denen jemand vergeblich zweimal übersprungen hat, rechnen das zweite Überspringen jetzt mit.

- [x] Doppelfeld-Training: Blöcke zeigen Ziel, Darts aufs aktuelle Doppel, Darts gesamt, „Bei Treffer“ (Quote auf dem Doppel, wenn der nächste trifft) und Quote; „Getroffen“ und „Falsch“ entfallen (Treffer stehen im Kästchen). „Quote bei Treffer“ war auf dem iPhone zu lang, daher „Bei Treffer“.

- [x] Um die Plätze weiterspielen (SPEC 5.0, G79–G85): X01, Cricket und Around the Clock fragen ab 3 Spielern nach dem Sieg „Weiterspielen um Platz 2“ oder „Spiel beenden“; das Doppelfeld-Training fragt wie 121, wenn der Erste fertig ist. Plätze im Ergebnis und im Spielverlauf.

Annahmen (Plätze): Gilt nur für Spiele ab diesem Stand (Vermerk `playOn` im Spiel), damit ältere beendete Spiele nicht wieder aufgehen. Bei X01 mit mehreren Legs wird nur das letzte Leg weitergespielt. Spiel- und Leg-Siege zählen nur für den Sieger; alle Darts danach zählen normal. Bei Cricket zählen für Platz 2 usw. nur die noch nicht platzierten Gegner. Die Frage kommt auch, wenn nur Computer übrig sind. „Weiterspielen“ bestätigt die letzte Aufnahme gleich mit; Rückgängig nimmt beides zusammen zurück.

Verworfen (Plätze): ein neues Leg nur um die Plätze (zu lang, die Stände sind schon da); die Frage auch bei 2 Spielern (Gianluca: sinnlos); Plätze in die Turnier-Tabelle übernehmen (Turnierpartien haben immer 2 Spieler).

Verworfen: „Spiel beenden“ als dauerhafter Knopf (Gianluca wünscht eine Frage im richtigen Moment); Beenden durch automatisches Überspringen aller offenen Zahlen (würde die Statistik verfälschen).

## Phase 5 – Daten mehrerer Geräte

- Import mit Zusammenführen, Profile verknüpfen (`profile.linked`)
- Danach Entscheidung durch Gianluca, ob echte Synchronisation (z. B. Supabase) kommt
