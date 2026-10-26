# Darts-Scorer – Spezifikation

Stand: 25.10.2026 · Version 0.1 (Entwurf zur Freigabe) · Autor: Claude mit Gianluca

Diese Datei ist die verbindliche Beschreibung der App. Jede Regel, jede Einstellung und jede Kennzahl steht hier. Der Code richtet sich nach dieser Datei, nicht umgekehrt. Wenn sich etwas ändert, wird zuerst diese Datei geändert.

„Darts“ meint immer das Spiel mit Pfeilen und Scheibe, nicht die Programmiersprache.

---

## Inhalt

1. Begriffe
2. Technischer Aufbau
3. Datenmodell (Ereignisspeicher)
4. Board-Eingabe und weitere Eingabearten
5. Ablauf eines Spiels (für alle Modi gleich)
6. Profile, Gäste, Spielerreihenfolge
7. Spielmodi mit Regeln und Einstellungen
8. Turnier
9. Computergegner
10. Sprachausgabe
11. Statistik und Kennzahlen (mit Formeln)
12. Bestleistungs-Vergleich
13. Speicher, Export, Import (inkl. iPhone-Befund)
14. Tests und Gegenprüfung
15. Annahmen ohne Rückfrage und verworfene Alternativen

---

## 1. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Dart** | Ein einzelner Wurf. Kleinste Einheit, die gespeichert wird. |
| **Feld** | Wo der Dart steckt: Zahl (1–20 oder Bull) plus Ring (Single, Double, Triple). Schreibweise: `S20`, `D16`, `T19`, `SB` (Single-Bull, 25), `DB` (Bullseye, 50), `0` (daneben). |
| **Multiplikator** | Single = 1, Double = 2, Triple = 3. Daneben = 0. |
| **Aufnahme** | Bis zu 3 Darts eines Spielers hintereinander. Englisch „Turn“ oder „Round“. |
| **Runde** | Jeder Spieler hat einmal eine Aufnahme geworfen. |
| **Leg** | Ein einzelnes Spiel bis zum Sieg (z. B. von 501 auf 0). |
| **Set** | Mehrere Legs. Wer genug Legs gewinnt, gewinnt das Set. |
| **Match** | Das ganze Spiel, bestehend aus Legs oder Sets. |
| **Rest** | Bei X01: Punkte, die noch fehlen. |
| **Bust** | Bei X01: ungültige Aufnahme („überworfen“). Der Rest springt auf den Stand vor der Aufnahme zurück. |
| **Checkout** | Bei X01: der Wurf, der den Rest genau auf 0 bringt und damit das Leg gewinnt. |
| **Mark** | Bei Cricket und Shanghai: ein Treffer-Zeichen. Single = 1 Mark, Double = 2, Triple = 3. |

**Board-Maße** (Standard-Steeldartscheibe, Radius vom Mittelpunkt bis zur Außenkante des Drahts):

| Bereich | Radius |
|---|---|
| Bullseye (DB, 50) | 0 – 6,35 mm |
| Single-Bull (SB, 25) | 6,35 – 15,9 mm |
| Triple-Ring | 99 – 107 mm |
| Double-Ring | 162 – 170 mm |

Reihenfolge der Zahlen im Uhrzeigersinn, oben beginnend: **20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5.**

---

## 2. Technischer Aufbau

### 2.1 Die Logik dahinter (einfach erklärt)

Die App besteht aus drei Schichten, die streng getrennt sind:

1. **Spiellogik** – reine Rechenregeln. Sie bekommt eine Liste von Darts und sagt: Wer ist dran? Wie ist der Stand? War das ein Bust? Diese Schicht weiß nichts von Bildschirm oder Speicher. Deshalb kann man sie mit automatischen Tests vollständig prüfen.
2. **Speicher** – legt jeden Dart als Ereignis ab und gibt ihn wieder heraus. Ereignisse werden nie verändert oder gelöscht, nur ergänzt.
3. **Oberfläche** – zeichnet Board und Tafel, nimmt Fingertipps an und zeigt, was die Spiellogik ausrechnet.

Warum so? Wenn die Regeln getrennt sind, kann ein Fehler in der Optik nie einen falschen Spielstand erzeugen, und jede Regel lässt sich ohne Handy testen.

### 2.2 Werkzeuge

| Werkzeug | Wofür | Warum |
|---|---|---|
| **TypeScript** | Programmiersprache | JavaScript mit Typen. Der Rechner meldet viele Fehler schon beim Schreiben, z. B. wenn ein Multiplikator 4 sein soll. |
| **Vite** | Baut die App | Schnell, Standard, wenig Einstellungen. Node 24 ist auf dem Rechner installiert. |
| **Preact** | Oberfläche | Sehr klein (lädt schnell am Handy), gleiche Schreibweise wie React, dazu gibt es die meisten Anleitungen im Netz. |
| **IndexedDB über Dexie** | Speicher im Browser | IndexedDB ist der einzige Browser-Speicher, der große Datenmengen dauerhaft hält. Dexie macht die Bedienung einfacher. |
| **vite-plugin-pwa** | Installierbarkeit, Offline | Erzeugt Service Worker (lädt die App offline) und Manifest (Symbol auf dem Home-Bildschirm). |
| **Vitest** | Automatische Tests der Spiellogik | Läuft in Sekunden, gleiche Sprache wie die App. |
| **Playwright** | Automatischer Durchlauf in Handygröße | Simuliert iPhone und Android im Browser und spielt ein ganzes Leg durch, in Hoch- und Querformat. |
| **GitHub Pages + GitHub Actions** | Veröffentlichung | Kostenlos, kein Server. Bei jedem Hochladen wird die App automatisch gebaut, getestet und veröffentlicht. |

### 2.3 Ordnerstruktur (geplant)

```
src/
  engine/        Spiellogik, ohne Oberfläche (je Modus eine Datei, plus checkout/, stats/)
  data/          Ereignisspeicher, Export, Import
  ui/            Oberfläche (board/, screens/, components/)
tests/
  engine/        Vitest-Tests der Regeln
  e2e/           Playwright-Durchläufe
public/          Symbole, Manifest
```

---

## 3. Datenmodell (Ereignisspeicher)

### 3.1 Die Logik dahinter

Statt „Spielstand 351“ speichert die App nur, **was passiert ist**: „Dart 1 von Gian in Aufnahme 4 traf T20“. Den Spielstand rechnet sie jedes Mal aus diesen Ereignissen aus. Vorteile:

- **Neue Kennzahlen gelten rückwirkend.** Wird später „Average nach Uhrzeit“ erfunden, rechnet die App ihn aus allen alten Darts aus.
- **Zusammenführen ohne Konflikte.** Jedes Ereignis hat eine weltweit eindeutige ID. Zwei Geräte vereinigen einfach ihre Ereignismengen; doppelte IDs werden einmal genommen.
- **Rückgängig verliert nichts.** Ein Rückgängig ist selbst ein Ereignis („Dart X widerrufen“). Der ursprüngliche Dart bleibt im Speicher.

### 3.2 Gemeinsame Felder jedes Ereignisses

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | Text (UUID v7) | Eindeutige ID. Version 7 enthält die Uhrzeit und lässt sich deshalb sortieren. |
| `type` | Text | Art des Ereignisses (siehe 3.3). |
| `ts` | Zahl | Zeitpunkt in Millisekunden seit 1970, UTC. |
| `deviceId` | Text (UUID) | Gerät, auf dem das Ereignis entstand. Wird beim ersten Start einmal erzeugt. |
| `seq` | Zahl | Laufende Nummer pro Gerät. Ordnet Ereignisse mit gleichem Zeitstempel. |
| `v` | Zahl | Version des Ereignisformats (Start: 1). |
| `payload` | Objekt | Inhalt, je nach `type`. |

### 3.3 Ereignisarten

| `type` | Inhalt (`payload`) | Wann |
|---|---|---|
| `profile.created` | `profileId`, `name`, `color` | Person angelegt |
| `profile.renamed` | `profileId`, `name` | Name geändert |
| `profile.archived` / `profile.restored` | `profileId` | Ausblenden statt löschen |
| `game.created` | `gameId`, `mode`, `settings`, `advice` (Checkout-Hilfe, nur X01), `participants[]`, `seed`, `start` (`bull` / `coin` / `asEntered`, fehlt bei älteren Spielen = `asEntered`), `tournamentMatchId?` | Spiel gestartet. Bei `bull`/`coin` folgt erst der Bildschirm „Wer wirft zuerst?“, dann `game.orderDecided`. Eine Revanche lost dann neu aus. |
| `game.orderDecided` | `gameId`, `order[]`, `method` (`bull` / `coin` / `asEntered`) | Reihenfolge feststeht |
| `bulloff.throw` | `gameId`, `slot`, `attempt`, `xMm`, `yMm`, `distanceMm` | Ein Ausbullen-Dart |
| `dart.thrown` | siehe 3.4 | Jeder Dart |
| `turn.confirmed` | `gameId`, `leg`, `slot`, `turnIndex` | „Weiter“ getippt |
| `game.decision` | `gameId`, `slot`, `turnIndex`, `kind`, `end` | Antwort auf eine Frage im Spiel (z. B. nach einem Shanghai) |
| `event.voided` | `gameId`, `targetId`, `reason` (`undo` / `edit`) | Rückgängig oder Runde bearbeiten |
| `game.ended` | `gameId`, `reason` (`finished` / `abandoned`) | Spielende (Ergebnis wird berechnet, nicht gespeichert) |
| `game.hidden` | `gameId` | Spiel aus Listen und Statistik ausblenden (nur mit Freigabe, nie echtes Löschen) |
| `tournament.created`, `tournament.matchAssigned` | siehe Kapitel 8 | Turnier (Phase 4) |
| `profile.linked` | `fromProfileId`, `toProfileId` | Gleiche Person auf zwei Geräten zusammenführen (Phase 5) |

`participants[]`: je Eintrag `slot` (0, 1, 2 …), `kind` (`profile` / `guest` / `bot`), `profileId` oder `guestName` oder `botLevel`, bei Handicap `startScore`.

### 3.4 Das Dart-Ereignis

```
dart.thrown
  gameId        Spiel
  slot          Spielerplatz im Spiel
  leg           Nummer des Legs, fortlaufend über das ganze Match (ab 1)
  set           Nummer des Sets (ab 1, nur zur Information)
  turnIndex     Aufnahme-Nummer im Leg für diesen Spieler (ab 1)
  dartIndex     1, 2 oder 3
  field         { n: 1–20 | 25, m: 0 | 1 | 2 | 3 }  oder  null
  target        bei Trainings: Zielfeld, z. B. { n: 16, m: 2 }
  hit           bei Trainings: true / false
  input         "board" | "hitmiss" | "bot" | "auto"
  replaces      ID des Darts, den dieser ersetzt (nur bei Runde bearbeiten)
```

- **Die Position (`leg`, `slot`, `turnIndex`, `dartIndex`) ist maßgeblich.** Die Spiellogik ordnet Darts nach Position, nicht nach Uhrzeit. Ein bearbeiteter Dart bleibt so an seiner Stelle, und spätere Darts verrutschen nicht in eine andere Aufnahme.
- `input = "auto"`: Tippt ein Spieler „Weiter“ nach weniger als 3 Darts (ohne Bust oder Checkout), füllt die App die fehlenden Darts als „daneben“ auf. So zählt jede Aufnahme 3 Darts, wie am Board geworfen. Rückgängig nimmt „Weiter“ und diese aufgefüllten Darts zusammen zurück.

- `field.m = 0` heißt „daneben“ (0 Punkte, Feld bekannt als Fehlwurf).
- `field = null` heißt „Feld unbekannt“: kommt nur aus der Treffer/Falsch-Eingabe, wenn „Falsch“ getippt wird. Solche Darts zählen für Quoten, aber nicht für die Heatmap.
- Bull: `n = 25`, `m = 1` (Single-Bull, 25 Punkte) oder `m = 2` (Bullseye, 50 Punkte). `m = 3` ist beim Bull ungültig.
- Punkte eines Darts = `n × m`.
- Spielstand, Bust, Gewinner und alle Kennzahlen werden **nicht** gespeichert, sondern immer berechnet.

### 3.5 Reihenfolge und Gültigkeit

- Ereignisse werden nach (`ts`, `deviceId`, `seq`) gespeichert und gelesen. Darts eines Spiels wendet die Spiellogik nach ihrer Position an (3.4). Stehen zwei gültige Darts auf derselben Position, gilt der spätere; der andere wird im Fehlerprotokoll vermerkt.
- Ein Ereignis, auf das ein `event.voided` zeigt, wird übersprungen.
- Ein Spiel entsteht immer auf genau einem Gerät. Darum gibt es innerhalb eines Spiels keine Konflikte zwischen Geräten.
- Ein Dart, der nach der Spiellogik nicht mehr möglich ist (z. B. vierter Dart einer Aufnahme), wird bei der Berechnung ignoriert und im Fehlerprotokoll vermerkt, nie gelöscht.

### 3.6 Abgeleitete Zwischenspeicher

Für schnelle Listen (z. B. „letzte Spiele“, Statistik-Übersicht) darf die App berechnete Werte zwischenspeichern. Diese Zwischenspeicher sind jederzeit aus den Ereignissen neu berechenbar und dürfen neu aufgebaut werden. Ereignisse selbst werden nie verändert.

### 3.7 Formatänderungen

Ändert sich das Format eines Ereignisses, steigt `v`. Alte Ereignisse werden **nicht umgeschrieben**, sondern beim Lesen in das neue Format übersetzt. So kann eine neue App-Version keine alten Daten beschädigen.

---

## 4. Board-Eingabe und weitere Eingabearten

### 4.1 Die Logik dahinter

Am Handy ist das Board etwa 350 Punkte breit. Ein Double-Ring wäre dann nur 8 Punkte dick, empfohlen für Fingertipps sind 44. Deshalb trennt die App die Eingabe in zwei Schritte wie App 1: **Erst die Zahl** (großes Tortenstück), **dann den Ring** (Auswahlleiste). Anders als bei App 1 erscheint die Leiste **neben bzw. über dem Finger**, damit der Finger sie nicht verdeckt.

### 4.2 Aufbau des Boards auf dem Bildschirm

- Das Board ist ein Kreis mit drei Zonen (Anteile am Radius R des gezeichneten Boards):
  - **Bull-Zone** 0 – 0,16 R: wählt das Bull.
  - **Zahlen-Zone** 0,16 R – 0,84 R: 20 Tortenstücke zu je 18°, wählt die Zahl. Die Ringe sind darin nur als Orientierung gezeichnet.
  - **Daneben-Ring** 0,84 R – 1,00 R: trägt die Zahlen. Antippen = Fehlwurf (0 Punkte).
- Das Board füllt die verfügbare Breite bzw. Höhe maximal aus (Hochformat: unten, bildschirmbreit; Querformat: rechts, bildschirmhoch).
- Zusätzlich gibt es einen großen Knopf **„Daneben“** (mindestens 56 × 56 Punkte).
- In Modi mit Zielfeldern (Cricket, Shanghai, Around the Clock usw.) sind Zielfelder farbig, alle anderen grau. Graue Felder reagieren nicht, damit ein Vertipper (z. B. zwischen 15 und 17) kein falsches Feld einträgt. Ein Dart neben die Ziele wird über den Daneben-Ring oder den Knopf „Daneben“ eingetragen; er zählt genauso (0 Marks bzw. 0 Punkte) und erscheint in der Heatmap als „Daneben“ (Entscheidung Gianluca, 26.10.2026; vorher waren graue Felder antippbar).

### 4.3 Bedienung „Antippen, Ziehen, Loslassen“

1. **Finger setzt auf** ein Tortenstück: Das Stück leuchtet auf. Oben in der Anzeige erscheint groß, was gerade gewählt ist (z. B. „S20 = 20“). Gleichzeitig erscheint die **Ring-Leiste**.
2. **Ring-Leiste**: drei Felder untereinander, unten **S**, darüber **D**, oben **T** (beim Bull nur **25** und **50**). Sie erscheint **oberhalb** des Fingers mit mindestens 24 Punkten Abstand, so dass das S-Feld direkt über der Fingerkuppe liegt.
   - Ist oben zu wenig Platz (z. B. Segment 20 im Querformat), erscheint die Leiste **seitlich** (links oder rechts, wo mehr Platz ist), waagerecht mit S am nächsten zum Finger.
   - Die Leiste liegt nie unter dem Finger.
3. **Auswahl durch Ziehen**: Gemessen wird nur, **wie weit** der Finger in Richtung der Leiste gezogen wird, nicht wo genau er steht. Stufen alle 50 Punkte: 0–49 → S, 50–99 → D, ab 100 → T (am Board auf iPhone und Android getestet, 25.10.2026). Die aktuell gewählte Stufe ist hervorgehoben, das Handy vibriert kurz bei jedem Stufenwechsel (nur Android; das iPhone erlaubt Web-Apps kein Vibrieren).
4. **Loslassen** übernimmt den Dart. Ohne Ziehen loslassen = **Single** (schnellster Weg für den häufigsten Fall).
5. **Abbrechen**: Zieht man den Finger aus dem Board heraus in die Gegenrichtung der Leiste (mehr als 60 Punkte), wird nichts eingetragen.
6. Mehrfinger-Berührungen werden ignoriert. Wischen zum Scrollen ist auf dem Board abgeschaltet.
7. **Kein Browser-Zoom:** Doppeltipp-Zoom ist in der ganzen App abgeschaltet, in der Spielansicht auch Zoom mit zwei Fingern. Sonst vergrößert Safari (iPhone, iPad) bei zwei schnellen Tipps auf dasselbe Feld die Seite (gefunden von Gianluca am iPad, 25.10.2026). Vergrößert wird nur beim Ausbullen, und zwar durch die App selbst (6.4).

### 4.4 Anzeige der Aufnahme

- Jeder Dart der aktuellen Aufnahme erscheint als **Pill** (z. B. „T20 · 60“) mit ×-Knopf. × entfernt diesen Dart (ist ein `event.voided`).
- Darunter die **Rechenzeile**, z. B. „427 − 76 = 351“.
- Knöpfe: **Rückgängig** (letzter Dart), **Runde bearbeiten**, **Weiter** (beendet die Aufnahme), **Daneben**.
- Nach dem dritten Dart, nach Bust und nach Checkout sind weitere Darts gesperrt. Die Aufnahme bleibt sichtbar, bis **Weiter** getippt wird.

### 4.5 Treffer/Falsch-Eingabe (Doppelfeld-Training, Bob's 27)

Drei große Flächen nebeneinander (Hochformat: untereinander), wie in App 2:

| Fläche | Wirkung |
|---|---|
| **↶ Rückgängig** | letzten Dart widerrufen |
| **Falsch** | Dart hat das Ziel verfehlt (`hit = false`, `field = null`) |
| **Treffer**, beschriftet mit dem Ziel (z. B. „D15“) | Dart hat das Ziel getroffen (`hit = true`, `field = Ziel`) |

Darüber die Aufnahme-Leiste mit 3 Plätzen und dem **Weiter**-Knopf. Jede Fläche ist mindestens ein Drittel der Breite und 40 % der Bildschirmhöhe groß.

### 4.6 Ausbullen-Eingabe

Siehe 6.4.

---

## 5. Ablauf eines Spiels (für alle Modi gleich)

1. **Modus wählen** → **Setup**: Spieler wählen (Profile, Gäste, Computer), Einstellungen des Modus, wer beginnt. Knopf **„Regeln“** zeigt die Regeln passend zu den gewählten Einstellungen (5.4).
2. **Wer beginnt** (6.3).
3. **Spielen**: Aufnahme eingeben → **Weiter** → nächster Spieler.
4. **Leg-Ende**: Anzeige des Gewinners und der Leg-Kennzahlen, dann nächstes Leg.
5. **Match-Ende**: Ergebnis, Kennzahlen, Knöpfe „Revanche“ (gleiche Einstellungen) und „Fertig“.
6. **Abbrechen** ist jederzeit möglich (Rückfrage). Abgebrochene Spiele bleiben gespeichert und zählen in Quoten (jeder geworfene Dart ist echt), aber nicht in Bestleistungen (11.1).
7. Ein laufendes Spiel übersteht Schließen der App, Sperrbildschirm und Neustart: Beim Öffnen fragt die App „Spiel fortsetzen?“.

### 5.1 Rückgängig

- Widerruft den letzten noch gültigen Dart des Spiels, auch über eine Aufnahme-, Leg- oder Set-Grenze hinweg. Ist die Aufnahme schon mit Weiter bestätigt und hat der nächste Spieler noch nichts geworfen, wird zuerst das Weiter widerrufen.
- Beliebig oft hintereinander möglich, bis zum Spielbeginn.

### 5.2 Runde bearbeiten

- Öffnet eine Liste aller Aufnahmen **des laufenden Legs** (wie „Edit Round“ in App 1). Man wählt eine Aufnahme, sieht deren Darts als Pills und das Board.
- Man kann Darts entfernen (×), ersetzen (Pill antippen, dann Board) oder ergänzen (bis 3).
- Die App rechnet danach alles neu. Ändert die Bearbeitung den Ausgang des Legs (z. B. entsteht dadurch früher ein Checkout oder ein Bust), zeigt die App vorher an, was sich ändert („Danach geworfene 4 Darts werden verworfen“), und verlangt eine Bestätigung.
- Abgeschlossene Legs sind nicht bearbeitbar, nur über Rückgängig erreichbar.
- Technisch: alte Darts bekommen `event.voided` mit `reason = edit`, neue Darts tragen `replaces`.

### 5.3 Anzeige während des Spiels

- Je Spieler: Name, Stand (Rest bzw. Punkte/Marks), Darts, Average bzw. Marks pro Runde, bei X01 Checkout-Vorschlag.
- Wer dran ist, ist deutlich hervorgehoben.
- Bei vielen Spielern: Liste scrollt, der aktive Spieler bleibt sichtbar.
- Knopf **„Bestleistung“** (Kapitel 12).
- X01 mit mehr als einem Leg: Knopf **„Legs“** in der Kopfzeile (Leg-Übersicht, immer sichtbar). Tabelle je Leg mit dem 3-Dart-Average jedes Spielers, seinen Darts, dem Leg-Gewinner (✔) und den Aufnahmen 80+ … 180 dieses Legs (nur Bereiche, die vorkamen, z. B. „100+ ×2“), unten der Average über das Match. Das laufende Leg erscheint mit dem bisherigen Stand. Dieselbe Tabelle steht am Spielende, dazu die Aufnahmen 80+ … 180 im Match (Wunsch Gianluca, 26.10.2026).
- Bildschirm bleibt an, solange ein Spiel läuft (Screen Wake Lock, wo unterstützt).

### 5.4 Regelerklärung

Jeder Modus hat einen Regeltext aus Bausteinen. Die Bausteine werden nach den gewählten Einstellungen zusammengesetzt, z. B. bei X01 mit Double-In: „Deine Punkte zählen erst, wenn du ein Double triffst. Das Double selbst zählt schon.“ Die Texte stehen in Kapitel 7 je Modus unter „Regeltext“.

Darunter erklärt die Regelansicht **alle Varianten des Modus im Überblick**, nicht nur die gewählte – z. B. bei Cricket, was sich bei Cut-Throat gegenüber Standard ändert, bei X01 alle In- und Out-Arten, Legs/Sets, Checkout-Hilfe und Handicap; in jedem Modus auch, wie bestimmt wird, wer beginnt (Wunsch Gianluca, 26.10.2026).

---

## 6. Profile, Gäste, Spielerreihenfolge

### 6.1 Profile

- Anlegen mit Name (Pflicht, eindeutig unter den aktiven Profilen) und Farbe.
- Umbenennen jederzeit (Statistik bleibt, weil sie an der `profileId` hängt, nicht am Namen).
- **Archivieren** statt löschen: Profil verschwindet aus der Auswahl, Daten bleiben. Wiederherstellen möglich.
- Beliebig viele Profile, beliebig viele Spieler pro Spiel. Mindestens 1 Spieler (Training allein), Ausnahmen: Killer und Turnier mindestens 2.

### 6.2 Gäste

- Nur ein Name für dieses Spiel, kein Profil.
- Ihre Darts werden gespeichert (sonst wäre das Spiel nicht nachrechenbar), aber keiner Statistik zugeordnet und nicht in Auswertungen gezeigt.

### 6.3 Wer beginnt

Im Setup wählbar:

| Wahl | Wirkung |
|---|---|
| **Ausbullen** | Jeder wirft einen Dart auf das Bull (6.4). |
| **Münzwurf** | Bei 2 Spielern: Zufall entscheidet, wer beginnt (Animation einer Münze). Bei mehr Spielern: zufällige Reihenfolge aller. Zufall aus `crypto.getRandomValues`. |
| **Wie eingetragen** | Reihenfolge der Auswahl. Standard bei 1 Spieler. |

Weitere Legs: Der Anwurf wechselt reihum. Leg k (über das ganze Match gezählt, ab 0) beginnt der Spieler an Position `k mod Spielerzahl` der festgelegten Reihenfolge. Die übrige Reihenfolge rückt entsprechend nach.

### 6.4 Ausbullen

1. Anzeige „Wirf auf das Bull und markiere es!“, oben eine Kachel je Spieler.
2. Gezeigt wird zu Beginn ein **vergrößerter Ausschnitt** um das Bull (etwa ±45 mm). Die Grafik ist ein ganzes Board in echten Maßen (eigene, neutrale Grafik, nur die Zahlen 1–20). **Zoom durch die App selbst**, hinein und heraus (der Browser-Zoom ist in der App aus, 4.3 Punkt 7): zwei Finger auseinander/zusammen (verschiebt auch den Ausschnitt), Doppeltipp vergrößert an der Stelle, Knöpfe −, + und „Bull“ (zurück zur Startansicht). Von ±6 mm bis zum ganzen Board (±190 mm). Ein Finger setzt den Punkt (Wunsch Gianluca, 25.10.2026).
3. Spieler tippt die Stelle an, an der sein Dart steckt. Ein Punkt in Spielerfarbe erscheint und lässt sich mit dem Finger verschieben. Eine Lupe über dem Finger zeigt die Stelle vergrößert.
4. **„Wurf bestätigen“** → Kachel zeigt:
   - Abstand ≤ 6,35 mm: „Bullseye“ und den Abstand
   - Abstand ≤ 15,9 mm: „Single-Bull“ und den Abstand
   - sonst „x,x mm vom Bull“
   Abstand = Entfernung zum Mittelpunkt in Millimeter, eine Nachkommastelle: `d = √(x² + y²)`.
5. Nächster Spieler. Bereits gesetzte Punkte bleiben sichtbar.
6. Nach dem letzten Spieler: **Reihenfolge = aufsteigender Abstand.** Es zählt immer der Abstand, auch innerhalb des Bulls. Haben Spieler **exakt denselben** Wert (auf 0,1 mm), werfen nur diese erneut, um ihre Plätze untereinander.
7. Knöpfe **„Erneut werfen“** (alle nochmal) und **„Spiel anfangen (5)“** mit 5-Sekunden-Countdown, abbrechbar durch Antippen.

---

## 7. Spielmodi

Für jeden Modus: Einstellungen, Regeln, Spielende, Regeltext. Standardwerte sind **fett**.

### 7.1 X01 (Phase 1)

**Einstellungen**

| Einstellung | Werte |
|---|---|
| Startpunkte | 301, **501**, 701, frei (2–9999) |
| In | **Single**, Double, Master |
| Out | Single, **Double**, Master |
| Legs | Anzahl N (1–99, **3**), Art **„first to“** oder „best of“ |
| Sets | aus (**nur Legs**) oder Anzahl M mit „first to“/„best of“ |
| Checkout-Vorschläge | **Experte**, Einsteiger, Aus |
| Handicap (Phase 3) | eigener Startwert je Spieler (2–9999) |

„best of N“ ist nur mit ungeradem N wählbar und bedeutet „first to (N+1)/2“. Beispiel: best of 5 = first to 3.

**Regeln**

1. Jeder Spieler beginnt mit dem Startwert als Rest.
2. Punkte eines Darts = Zahl × Multiplikator. Bullseye = 50, Single-Bull = 25.
3. **In-Regel:** Solange ein Spieler „nicht drin“ ist, zählen seine Darts 0 Punkte.
   - Single-In: jeder Dart mit Punkten bringt ihn rein (er ist von Anfang an drin).
   - Double-In: erst ein Double (inkl. Bullseye) bringt ihn rein.
   - Master-In: ein Double oder Triple (inkl. Bullseye) bringt ihn rein.
   - Der Dart, der ihn reinbringt, **zählt bereits**. Folgende Darts derselben Aufnahme zählen auch.
4. **Neuer Rest** nach jedem Dart: `rest_neu = rest_alt − punkte`.
5. **Bust**, wenn nach einem Dart gilt:
   - `rest_neu < 0`, oder
   - `rest_neu = 1` und Out ist Double oder Master (1 kann man mit keinem Double/Triple löschen), oder
   - `rest_neu = 0` und der Dart passt nicht zur Out-Regel (Double-Out: kein Double und kein Bullseye; Master-Out: weder Double noch Triple noch Bullseye).
   - Bei Single-Out ist `rest_neu = 1` erlaubt.
6. **Folgen eines Busts:** Rest und In-Status springen auf den Stand vor der Aufnahme zurück. Die Aufnahme ist sofort beendet, weitere Darts sind gesperrt. Die geworfenen Darts (1–3) zählen als geworfen, mit 0 Punkten.
7. **Checkout:** `rest_neu = 0` und der Dart passt zur Out-Regel → Leg gewonnen, sofort, auch mit Dart 1 oder 2.
8. **Bullseye gilt als Double** (D25) für In und Out. Single-Bull ist kein Double.
9. Leg gewonnen → Legs-Zähler +1. Erreicht ein Spieler die nötigen Legs, gewinnt er das Set (bzw. das Match ohne Sets). Erreicht er die nötigen Sets, gewinnt er das Match.
10. Bei mehr als 2 Spielern endet ein Leg mit dem ersten Checkout. Es wird nicht um weitere Plätze gespielt.

**Checkout-Vorschläge**

- Angezeigt, wenn der Rest mit den **in dieser Aufnahme noch übrigen Darts** (3, 2 oder 1) gecheckt werden kann. Sonst kein Vorschlag.
- Bei Double-Out ist der höchste Checkout **170** (T20 T20 Bull). Über 170 gibt es nie einen Vorschlag.
- Bis 170 **nicht** checkbar mit 3 Darts (Double-Out): **169, 168, 166, 165, 163, 162, 159.** Für diese Werte kein Vorschlag.
- Single-Out und Master-Out: höchster Checkout **180** (T20 T20 T20). Eigene Tabellen.
- Erzeugt wird die Tabelle durch ein Programm, das alle Kombinationen aus 1–3 Darts durchprobiert (ohne Bust unterwegs) und den Weg mit den niedrigsten **Kosten** wählt. Kosten statt einer starren Rangfolge, weil Profis abwägen: Ein etwas schlechteres Triple ist besser als ein schlechtes Double am Ende (64 → T16 D8 statt T20 D2).

  **Experte** (wie Profis rechnen), Kosten eines Wegs = Summe aus:
  1. 100 je Dart (wenigste Darts gehen immer vor);
  2. letzter Dart: Platz in der Double-Reihenfolge × 0,6, Reihenfolge D20, D16, D8, D18, D12, D10, D4, D14, D6, D2, D19, D17, D15, D13, D11, D9, D7, D5, D3, D1; Bullseye 7;
  3. je Vorbereitungs-Dart: T20 0, T19 1, T18 2, T17 3, T16 4, T15 5, kleinere Triples 6 bis 7,4; Single 2; Bull (25 oder 50) 6; Double 12;
  4. +1 je Triple-Vorbereitungs-Dart, nach dessen Single-Treffer kein Checkout mehr möglich wäre (Robustheit);
  5. bei gleichen Feldern zuerst der bessere Dart (T20 T19 statt T19 T20); danach entscheidet die Schreibweise, damit das Ergebnis immer gleich ist.

  **Einsteiger** (leichte Felder vor wenigen Darts):
  1. kleinste Summe der „Schwierigkeit“: Single 1, Double 3 (als Vorbereitung 4,5), Single-Bull 3, Triple 4, Bullseye 6;
  2. dann wenigste Darts;
  3. dann wie Experte.

- **Zweiter Weg:** Nutzt der Hauptweg das Bull (25 oder 50) als Vorbereitungs-Dart, zeigt die App darunter klein „oder …“ mit dem besten Weg ohne Bull zur Vorbereitung (gleiche Stufe, gleiche Kosten-Regeln). Sonst gibt es keinen zweiten Weg. Gibt es keinen Weg ohne Bull, entfällt er ebenfalls. Bei Double-Out mit 3 Darts betrifft das beim Experten die Reste 142, 123, 82 und 66 (Entscheidung Gianluca, 25.10.2026).
- Die erzeugte Tabelle für alle Reste 2–170 (Double-Out, 3 Darts) samt zweiter Wege wird als Datei im Projekt abgelegt („Golden-Liste“) und von Gianluca einmal gegengelesen. Danach prüft ein Test jede Zeile.

**Regeltext** (Bausteine): Startwert; In-Regel; Out-Regel mit Erklärung Bust; Bull als Double; Legs/Sets mit Beispiel.

### 7.2 Cricket (Phase 2)

**Einstellungen**

| Einstellung | Werte |
|---|---|
| Zielzahlen | frei wählbar aus 1–20 und Bull, mindestens 1; **15, 16, 17, 18, 19, 20, Bull** |
| Treffer bis zu | 1–9, **3** |
| Variante | **Standard**, Cut-Throat |
| Legs/Sets | wie X01 (**1 Leg**) |

**Regeln**

1. Marks pro Dart auf eine Zielzahl: Single 1, Double 2, Triple 3. Bull: Single-Bull 1, Bullseye 2.
2. Darts auf Nicht-Zielzahlen: 0 Marks, zählen als geworfen.
3. Eine Zahl ist für einen Spieler **zu**, wenn er dort die eingestellte Trefferzahl erreicht hat.
4. **Überzählige Marks** (nachdem die Zahl für den Werfer zu ist, auch innerhalb desselben Darts: z. B. Triple bei 1 vorhandenen Mark → 2 schließen, 1 überzählig) ergeben Punkte: `überzählige Marks × Wert` (Bull = 25).
5. **Standard:** Der Werfer bekommt die Punkte **nur, wenn mindestens ein Gegner diese Zahl noch offen hat.** Haben alle Gegner sie zu, zählen die überzähligen Marks nichts.
6. **Cut-Throat:** Die Punkte gehen **an jeden Gegner, der diese Zahl noch offen hat**, jeweils in voller Höhe. Der Werfer bekommt nichts.
7. **Sieg Standard:** Ein Spieler gewinnt sofort, wenn er alle Zielzahlen zu hat **und** mindestens so viele Punkte hat wie jeder Gegner (≥).
8. **Sieg Cut-Throat:** Ein Spieler gewinnt sofort, wenn er alle Zielzahlen zu hat **und** höchstens so viele Punkte hat wie jeder Gegner (≤).
9. Hat ein Spieler alles zu, liegt aber bei den Punkten falsch, spielt er weiter und versucht zu punkten (Standard) bzw. wartet, bis Gegner Punkte bekommen (Cut-Throat).
10. Es gibt keine Rundenbegrenzung.

**Anzeige:** Tafel mit Zielzahlen in der Mitte, je Spieler die Marks als Zeichen „/“, „X“, „Ⓧ“ (bei mehr als 3 Treffern bis zu: Zahl der Marks), Punkte, Marks pro Runde.

**Regeltext:** Zielzahlen; Trefferzahl; Punkteregel je Variante; Siegbedingung je Variante.

### 7.3 Shanghai (Phase 2)

**Einstellungen**

| Einstellung | Werte |
|---|---|
| Startzahl | 1–20, **1** |
| Rundenzahl | 1 bis (22 − Startzahl), **20** |
| Shanghai beendet das Spiel (Vorauswahl der Frage) | **ja**, nein |

(Die Einstellung Double-/Triple-Out entfällt auf Gianlucas Wunsch, siehe 15.)

**Regeln**

1. Zielfolge: 1, 2, …, 20, Bull. Runde i hat das Ziel an Position (Startzahl + i − 1) dieser Folge. Beispiel Startzahl 1, 21 Runden: Runde 21 = Bull.
2. Pro Runde wirft jeder Spieler eine Aufnahme (3 Darts) auf das Ziel.
3. Punkte nur für Treffer auf das Ziel: Zahl × Multiplikator (Bull: 25 bzw. 50). Andere Felder 0.
4. **Shanghai** = in einer Aufnahme Single, Double **und** Triple des Ziels (Reihenfolge egal). Im Bull-Rundenziel ist kein Shanghai möglich (kein Triple).
5. Nach jedem Shanghai fragt die App: **„Spiel beenden“** oder **„Weiterspielen“** (Wunsch Gianluca, 25.10.2026). Die Einstellung „Shanghai beendet das Spiel“ bestimmt nur, welcher Knopf hervorgehoben ist. „Spiel beenden“: Der Werfer gewinnt sofort. „Weiterspielen“: Das Shanghai wird vermerkt, das Spiel läuft normal weiter. Die Antwort ist ein eigenes Ereignis `game.decision` (`gameId`, `slot`, `turnIndex`, `kind = shanghai`, `end`). Bis zur Antwort ist „Weiter“ gesperrt. Rückgängig nimmt zuerst die Antwort zurück (nach „Weiterspielen“ zusammen mit dem automatischen Weiter, sodass die Frage sofort wieder erscheint; Wunsch Gianluca, 26.10.2026), dann den Dart.
6. Nach der letzten Runde gewinnt, wer die meisten Punkte hat. Bei Punktgleichheit teilen sich die Spieler den Platz.
7. Auf dem Board ist nur das aktuelle Ziel farbig.

**Regeltext:** Zielfolge mit Start und Ende; Punkte; was ein Shanghai ist und was es bewirkt.

### 7.4 Doppelfeld-Training (Phase 2)

**Einstellungen**

| Einstellung | Werte |
|---|---|
| Zielfolge | **jeder seine eigene Zufallsfolge**, alle dieselbe Zufallsfolge |
| Modus | **bis zum Treffer**, feste Zahl Darts pro Feld (1–30, Std. 9) |
| Ziele | frei wählbar aus D1–D20 und Bullseye, mindestens eins; **alle 21** (Wunsch Gianluca, 25.10.2026) |

**Regeln**

1. Ziele: die gewählten aus D1 bis D20 und Bullseye (Standard: alle 21). Beim Bull zählt **nur das Bullseye**. Ältere Spiele ohne Zielauswahl gelten als „alle 21“; ihre Zufallsfolge bleibt dieselbe. Alle Angaben „21“ in diesem Abschnitt meinen „Anzahl der gewählten Ziele“.
2. Zufallsfolge: Mischen nach Fisher-Yates mit einem Zufallswert (`seed`), der im Spiel gespeichert wird. Dadurch ist die Folge später nachvollziehbar. Bei „dieselbe Folge“ ein Seed für alle, sonst ein Seed je Spieler.
3. Eingabe über Treffer/Falsch (4.5). Treffer = genau das Ziel-Double (beim Bull: Bullseye).
4. **Bis zum Treffer:** Ein Ziel bleibt, bis es getroffen ist. Danach kommt sofort das nächste Ziel, auch mitten in der Aufnahme. Ein Spieler ist fertig, wenn er alle 21 Ziele getroffen hat. Fertige Spieler werden übersprungen. Spielende, wenn alle fertig sind. Platzierung: wenigste Darts.
5. **Feste Zahl n:** Jedes Ziel bekommt genau n Darts, egal ob getroffen. Nach n Darts wechselt das Ziel, auch mitten in der Aufnahme. Spielende nach 21 × n Darts je Spieler. Platzierung: meiste Treffer, bei Gleichstand gleicher Platz.
6. Anzeige je Spieler: Ziel, Getroffen, Falsch, geworfene Darts, Quote %. Verlaufstabelle: Ziel und benötigte Darts.
7. **Ergebnis am Ende**, je Spieler und Feld: Würfe, Treffer, Trefferquote in %; dazu Gesamtwürfe und Gesamtquote.

**Regeltext:** Ziele; Bull nur Bullseye; Folge gemeinsam/eigen; Modus.

### 7.5 Around the Clock (Phase 3)

| Einstellung | Werte |
|---|---|
| Ziele | **1–20**, 1–20 + Bull |
| Ring | **beliebig** (S/D/T zählt), nur Doubles, nur Triples |
| Sprünge | **aus**; an: Double springt 2 Ziele weiter, Triple 3 (nur bei Ring „beliebig“) |

Regeln: Ziele der Reihe nach treffen. Ein Treffer bringt sofort das nächste Ziel, auch mitten in der Aufnahme. Wer das letzte Ziel trifft, gewinnt sofort. Mit Sprüngen über das letzte Ziel hinaus = Ziel erreicht. Am Bull gibt es kein Triple: Bei „nur Triples“ zählt dort das Bullseye, bei „nur Doubles“ ebenfalls das Bullseye, bei „beliebig“ Single-Bull und Bullseye (Sprung immer 1). Auf dem Board ist nur das aktuelle Ziel des Werfers farbig. Kennzahlen: Darts bis Ende, Trefferquote (Vergleichsgruppe: Ziele + Ring + Sprünge).

**Regeltext:** Zielfolge; welcher Ring zählt; Sprünge; Sieg.

### 7.6 Killer (Phase 3)

| Einstellung | Werte |
|---|---|
| Zahlen-Zuteilung | **zufällig** (jede Zahl nur einmal), selbst wählen |
| Leben | 1–9, **3** |
| Treffer bis Killer | 1–3, **1** |
| Trefferzone | **nur Double**, ganzes Segment |
| Eigentreffer als Killer | **kostet ein Leben**, zählt nicht |

Regeln:
1. Jeder Spieler hat eine eigene Zahl. Mindestens 2 Spieler, höchstens 20.
2. Wer die eingestellte Zahl Treffer auf seine eigene Zahl (in der Trefferzone) hat, wird **Killer**.
3. Ein Killer nimmt mit jedem Treffer auf die Zahl eines Gegners diesem ein Leben (Triple bei Zone „ganzes Segment“: 1 Leben; bei Zone Double: 1 Leben je Double).
4. Wer 0 Leben hat, scheidet aus. Der letzte Spieler mit Leben gewinnt.
5. Treffer vor dem Killer-Status auf fremde Zahlen zählen nichts.
6. Ein Killer, der seine eigene Zahl trifft, verliert bei „kostet ein Leben“ ein Leben; scheidet er dabei aus, endet seine Aufnahme.
7. Bleibt nur ein Spieler mit Leben übrig, gewinnt er sofort.

Genauer (Annahmen Phase 3): Die Zahlen werden beim Start festgelegt und mit dem Spiel gespeichert – „zufällig“ verteilt die App sie, bei „selbst wählen“ wählt jeder im Setup seine Zahl (keine doppelt). Auf dem Board sind für Nicht-Killer nur die eigene Zahl farbig, für Killer die Zahlen aller Spieler, die noch im Spiel sind. Killer hat keine Kennzahlen und keinen Bestleistungs-Vergleich; das Spiel erscheint in „Letzte Spiele“ mit Sieger.

**Regeltext:** Zahlen; Killer werden; Leben nehmen; Eigentreffer; Ausscheiden und Sieg.

### 7.7 121 (Phase 3)

| Einstellung | Werte |
|---|---|
| Startziel | **121** (frei 61–170) |
| Darts pro Versuch | **9** (3, 6, 9, 12) |
| Out | **Double**, Master |
| Nach Fehlschlag | **gleiches Ziel nochmal**, Ziel −1 (nicht unter Startziel) |
| Versuche | **10** (1–50) |

Regeln: Pro Versuch ist das Ziel der Rest; X01-Regeln für Bust und Out. Bust setzt auf den Rest am Anfang der Aufnahme zurück, der Versuch läuft weiter, solange Darts übrig sind. Checkout innerhalb der Darts → nächstes Ziel = Ziel + 1. Ergebnis: höchstes gechecktes Ziel und Anzahl Erfolge. Spieler wechseln sich je Aufnahme ab.

Genauer (Annahmen Phase 3): Ein Versuch hat Darts/3 Aufnahmen. Ein Bust beendet die Aufnahme wie bei X01, ihre restlichen Darts verfallen. Ein Checkout beendet Aufnahme und Versuch sofort; der nächste Versuch beginnt mit der nächsten Aufnahme. Das Ziel steigt höchstens bis 170. Das Spiel endet, wenn alle Spieler ihre Versuche gespielt haben. Es gewinnt, wer das höchste Ziel gecheckt hat, bei Gleichstand wer mehr Erfolge hat; sonst teilen sich die Spieler den Sieg. Der Checkout-Vorschlag zeigt wie bei X01 einen Weg für die Darts der laufenden Aufnahme. Kennzahlen: höchstes gechecktes Ziel, Erfolge, Erfolgsquote (Vergleichsgruppe: alle Einstellungen).

**Regeltext:** Ziel und Darts je Versuch; Out und Bust; nach Erfolg bzw. Fehlschlag; Anzahl Versuche; Sieger.

### 7.8 Bob's 27 (Phase 3)

Ohne Einstellungen außer **„Bei 0 oder weniger ausscheiden“** (**ja**, nein).
Regeln: Start mit 27 Punkten. Ziele D1, D2, …, D20, Bullseye; je Ziel eine Aufnahme mit 3 Darts. Jeder Treffer: + Wert des Doubles (D7 = 14, Bullseye = 50). Kein Treffer in der Aufnahme: − Wert des Doubles. Eingabe Treffer/Falsch. Ergebnis: Endpunkte; Doubles fließen in die Doppelquote pro Feld ein. Abgerechnet wird nach dem dritten Dart der Aufnahme („Weiter“ füllt mit Falsch auf). Wer ausscheidet, wird übersprungen. Das Spiel endet, wenn alle durch sind oder ausgeschieden; es gewinnt, wer die meisten Punkte hat, bei Gleichstand teilen sich die Spieler den Sieg. Kennzahlen: Endpunkte, Trefferquote (Vergleichsgruppe: „ausscheiden“ ja/nein).

**Regeltext:** Start 27; Zielfolge; Plus je Treffer, Minus ohne Treffer; Ausscheiden; Sieger.

### 7.9 Halve-It (Phase 3)

| Einstellung | Werte |
|---|---|
| Zielfolge | **15, 16, beliebiges Double, 17, 18, beliebiges Triple, 19, 20, Bull**, frei zusammenstellbar |
| Startpunkte | **0** (0–100) |

Regeln: Je Ziel eine Aufnahme. Treffer aufs Ziel zählen Zahl × Multiplikator („beliebiges Double/Triple“: Wert des getroffenen Feldes; Bull: 25/50). Das Bullseye zählt als beliebiges Double, ein Triple gibt es am Bull nicht. Kein Treffer in der Aufnahme: Gesamtpunkte werden nach dem dritten Dart halbiert, abgerundet („Weiter“ füllt mit Fehlwürfen auf). Meiste Punkte gewinnen, bei Gleichstand teilen sich die Spieler den Sieg. Frei zusammenstellbar: 1 bis 30 Ziele aus 1–20, Bull, beliebiges Double, beliebiges Triple, auch mehrfach. Auf dem Board sind die Felder des aktuellen Ziels farbig (bei „beliebiges Double“ alle Zahlen und Bull, bei „beliebiges Triple“ alle Zahlen). Kennzahl: Endpunkte (Vergleichsgruppe: Zielfolge + Startpunkte).

**Regeltext:** Zielfolge; Punkte je Treffer; Halbieren; Sieger.

### 7.10 Count-Up (Phase 3)

| Einstellung | Werte |
|---|---|
| Runden | **8** (1–50) |

Regeln: Jede Aufnahme zählt ihre Punkte (Single-Bull 25, Bullseye 50). Nach der letzten Runde gewinnen die meisten Punkte, bei Gleichstand teilen sich die Spieler den Sieg. Kennzahlen: Endpunkte, 3-Dart-Average (Vergleichsgruppe: Rundenzahl).

**Regeltext:** Rundenzahl; Punkte je Dart; Sieger.

---

## 8. Turnier (Phase 4)

**Einstellungen:** Teilnehmer (Profile, Gäste, Computer; mindestens 2), Spielmodus und dessen Einstellungen für alle Partien, Turnierform.

| Form | Ablauf |
|---|---|
| **K.-o.** | Feldgröße = nächste Zweierpotenz ≥ Teilnehmerzahl. Fehlende Plätze sind **Freilose**; sie werden zufällig verteilt, nie zwei Freilose gegeneinander. Wer ein Freilos hat, kommt ohne Spiel weiter. |
| **Jeder gegen jeden** | Jede Paarung einmal (wählbar: zweimal). Spielplan nach Rundenturnier-Verfahren („Kreisverfahren“), so dass möglichst jeder pro Runde spielt. |
| **Gruppen + K.-o.** | Gruppenanzahl G und Weiterkommende pro Gruppe K einstellbar. Gruppen zufällig gelost. Danach K.-o.: Gruppenerster gegen Gruppenzweiten einer anderen Gruppe (A1–B2, B1–A2 …). |

**Tabelle (Jeder gegen jeden, Gruppen):** Sieg 2 Punkte, Niederlage 0. Reihenfolge bei Gleichstand: 1. Punkte, 2. Leg-Differenz, 3. gewonnene Legs, 4. direkter Vergleich, 5. 3-Dart-Average (bei X01) bzw. Marks pro Runde (Cricket), 6. Los.

Jede Partie ist ein normales Spiel mit eigener `gameId` und `tournamentMatchId`. Die Partien eines Turniers zählen in die Profil-Statistik.

---

## 9. Computergegner (Phase 3)

**Die Logik dahinter:** Der Computer „zielt“ auf einen Punkt des Boards und „trifft“ daneben mit einer zufälligen Streuung. Je kleiner die Streuung, desto stärker. So entstehen realistische Fehler, z. B. 1 und 5 neben der 20.

- **Stärkestufen 1–10.** Streuung als Normalverteilung um den Zielpunkt, Standardabweichung σ in mm je Stufe. Die σ-Werte werden in Phase 3 so eingestellt, dass in einer Simulation von 10 000 Legs 501 Double-Out folgende 3-Dart-Averages herauskommen (±2): Stufe 1 = 25, 2 = 35, 3 = 45, 4 = 52, 5 = 60, 6 = 67, 7 = 75, 8 = 83, 9 = 92, 10 = 100.
- **Zielwahl:** X01 auf T20 bis Rest ≤ 170, dann nach Experten-Checkout-Tabelle; Cricket: offene Zielzahl mit höchstem Wert, dann Punkte, wenn Gegner offen; andere Modi: aktuelles Ziel.
- Das getroffene Feld ergibt sich aus der Position nach den Board-Maßen (Kapitel 1).
- Der Computer wirft mit kurzer Pause pro Dart (0,8 s), die Darts erscheinen als Pills. Weiter tippt der Mensch.
- Computer haben keine Statistik. Spiele gegen den Computer zählen für das Profil des Menschen, sind aber in der Statistik filterbar („gegen Computer“).

---

## 10. Sprachausgabe (Phase 3)

- Über die Sprachausgabe des Geräts (Web Speech API, deutsche Stimme). Abschaltbar in den Einstellungen und im Spiel über ein Lautsprecher-Symbol. **Standard: an.**
- Angesagt wird nach jedem Weiter: Punkte der Aufnahme („Einhundertvierzig“), bei X01 der Rest, wenn ≤ 170 („Du brauchst zweiunddreißig“), „Bust“, „Game Shot“ bzw. „Leg gewonnen“, bei Cricket/Shanghai die Marks bzw. Punkte.
- Auf dem iPhone startet Sprache erst nach einer Berührung; die App aktiviert sie beim ersten Tippen auf „Spiel starten“.

---

## 11. Statistik und Kennzahlen

### 11.1 Grundsätze

- Alle Kennzahlen werden aus `dart.thrown`-Ereignissen berechnet (ohne widerrufene).
- Zuordnung über `profileId`. Gäste und Computer gehen in keine Profil-Statistik ein.
- **Quoten** (Trefferquote, Doppelquote) nutzen alle Darts, auch aus abgebrochenen Spielen.
- **Bestleistungen und Leg-Kennzahlen** nutzen nur abgeschlossene Legs bzw. Spiele.
- Vergleiche gibt es nur innerhalb einer **Vergleichsgruppe** gleicher Einstellungen (sonst würde 301 mit 701 verglichen):
  - X01: Startwert + In + Out
  - Cricket: Zielzahlen + Treffer bis zu + Variante
  - Shanghai: Startzahl + Rundenzahl + „Shanghai beendet“
  - Doppelfeld-Training: Modus (+ n) + gewählte Ziele
- Prozentwerte mit einer Nachkommastelle. Ist der Nenner 0, wird „—“ angezeigt.

### 11.2 X01 (je Leg und Spieler)

Bezeichnungen: `D` = geworfene Darts des Spielers im Leg (inklusive Bust-Darts und Darts vor dem Double-In), `P` = gezählte Punkte = Startwert − Rest am Leg-Ende (Bust-Aufnahmen zählen 0).

| Kennzahl | Formel |
|---|---|
| **3-Dart-Average** | `P / D × 3` |
| **First-9-Average** | Punkte der ersten 9 Darts (bzw. aller Darts, wenn weniger) / Anzahl dieser Darts × 3 |
| **Double-Versuch** | Ein Dart ist ein Double-Versuch, wenn der Rest **vor** diesem Dart mit einem einzigen Dart gecheckt werden kann. Double-Out: Rest ∈ {2, 4, 6, …, 40, 50}. Ziel-Feld = D(Rest/2), bei 50 Bullseye. Master-Out: zählt nur Reste mit Double-Möglichkeit (wie Double-Out), Single-Out: keine Versuche. Nur wenn der Spieler schon „drin“ ist. In einer Bust-Aufnahme läuft der Rest für die Versuche mit den geworfenen Punkten mit. |
| **Double-Out-Quote** | `Checkouts / Double-Versuche × 100 %` |
| **Darts bis zum Finish** | `D` in gewonnenen Legs (nur Legs, die der Spieler gecheckt hat) |
| **Höchster Checkout** | Rest zu Beginn der Aufnahme, in der gecheckt wurde |
| **Aufnahmen 80+ … 180** | Anzahl Aufnahmen mit Punktsumme in den Bereichen 80–99, 100–119, 120–139, 140–159, 160–179, genau 180. Die Bereiche schließen sich gegenseitig aus. Bust-Aufnahmen zählen 0. |

### 11.3 Cricket (je Leg und Spieler)

| Kennzahl | Formel |
|---|---|
| **Zählende Marks** | Marks, die eine Zahl schließen, plus überzählige Marks, die Punkte bringen (Standard) bzw. Gegnern Punkte geben (Cut-Throat). Marks ohne Wirkung zählen nicht. |
| **Marks pro 3 Darts (MPR)** | `zählende Marks / D × 3` |
| **Höchste Gesamtpunktzahl** | Punkte des Spielers am Leg-Ende. Nur bei Standard; bei Cut-Throat sind Punkte schlecht und keine Bestleistung. Für den Stand nach d Darts zählen die eigenen Punkte aus den ersten d Darts. |
| **Wenigste Darts bis zum Sieg** | `D` in gewonnenen Legs |

### 11.4 Shanghai (je Durchgang und Spieler)

| Kennzahl | Formel |
|---|---|
| **Marks** | je Dart auf das Ziel: Single 1, Double 2, Triple 3 (Bull: 1/2) |
| **Marks pro 3 Darts** | `Marks / D × 3`, höchstens 9 |
| **Schnellstes Shanghai** | kleinste Zahl geworfener Darts im Durchgang bis einschließlich des Darts, der das Shanghai vollendet; dazu das Feld (Zielzahl) |
| **Endpunkte** | Punkte am Ende des Durchgangs |

### 11.5 Doppelfeld-Training (je Durchgang und Spieler)

| Kennzahl | Formel |
|---|---|
| **Trefferquote gesamt** | `Treffer / Würfe × 100 %` |
| **Trefferquote je Feld** | `Treffer auf Feld / Würfe auf Feld × 100 %` |

### 11.6 Langzeitstatistik je Profil und Modus

- **Verlaufsdiagramm:** x-Achse Datum, y-Achse gewählte Kennzahl. Ein Punkt je Leg bzw. Durchgang, dazu eine Linie als gleitender Durchschnitt der letzten 10 Werte. Zeitraum wählbar: 30 Tage, 90 Tage, 1 Jahr, alles. Filter: Vergleichsgruppe, mit/ohne Computerspiele.
- **Treffer-Heatmap:** gezeichnetes Board, jedes Feld (S/D/T je Zahl, SB, DB, Daneben) eingefärbt nach Anteil: `Darts auf dieses Feld / alle Board-Darts × 100 %`. Farben als Wärmebild: selten blau, mittel weiß, oft rot; Felder ohne Darts bleiben dunkel (Wunsch Gianluca, 26.10.2026). Nur Darts aus der Board-Eingabe (`field` bekannt). Filter: Modus, Zeitraum.
- **Doppelquote je Feld** (D1–D20, Bullseye), in drei Spalten:
  - aus dem Training: `Treffer / Würfe` auf dieses Double (Doppelfeld-Training, Bob's 27)
  - aus X01: `Checkouts auf dieses Double / Double-Versuche auf dieses Double`
  - zusammen: Summe der Treffer / Summe der Versuche

---

## 12. Bestleistungs-Vergleich

**Die Logik dahinter:** Im laufenden Spiel tippt der Spieler auf **„Bestleistung“**. Die App sucht für jede Kennzahl seinen Rekord in derselben Vergleichsgruppe und zeigt, wie er gerade im Verhältnis dazu liegt.

- **Rekord** = bester je erreichter Wert der Kennzahl, jede Kennzahl einzeln (höher besser, außer „Darts bis …“ und „schnellstes Shanghai“: niedriger besser). Das Leg (bzw. der Durchgang), aus dem der Rekord stammt, heißt **Rekord-Leg**.
- **Sicht 1 – Stand nach gleich vielen Darts:** Hat der Spieler im laufenden Leg d Darts geworfen, wird die Kennzahl aus seinen ersten d Darts berechnet und mit der Kennzahl aus den ersten d Darts des Rekord-Legs verglichen. Hat das Rekord-Leg weniger als d Darts, wird dessen Endwert genommen. Kennzahlen, die erst am Ende feststehen (Darts bis zum Finish, wenigste Darts bis zum Sieg, schnellstes Shanghai, höchster Checkout), zeigen hier „—“.
- **Sicht 2 – Endwerte:** aktueller Wert der Kennzahl im laufenden Leg gegen den Rekordwert.
- **Abweichung in Prozent:** `(aktuell − Rekord) / Rekord × 100 %`, mit Vorzeichen. Grün = besser als Rekord, rot = schlechter (bei „niedriger ist besser“ entsprechend umgekehrt gefärbt). Rekord = 0 → „—“.
- Kennzahlen je Modus:
  - X01: 3-Dart-Average, First-9-Average, Double-Out-Quote, wenigste Darts bis zum Finish, höchster Checkout, Aufnahmen 80+, 100+, 120+, 140+, 160+, 180.
  - Cricket: Marks pro 3 Darts, höchste Gesamtpunktzahl, wenigste Darts bis zum Sieg.
  - Shanghai: Marks pro 3 Darts, schnellstes Shanghai mit Feld, Endpunkte.
  - Doppelfeld-Training: Trefferquote gesamt und je Feld.
- Gibt es noch keinen Rekord, zeigt die App „Noch keine Bestleistung in dieser Vergleichsgruppe“.

---

## 13. Speicher, Export, Import

### 13.1 Befund: Hält eine iPhone-PWA ihre Daten? (geprüft am 25.10.2026)

Quellen: [WebKit – Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [WebKit – Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/).

| Aussage | Bewertung |
|---|---|
| Läuft offline | **Ja**, über den Service Worker, sobald die App einmal online geladen wurde. |
| Daten bleiben bei Nutzung | **Weitgehend ja.** Safari löscht Daten von Webseiten nach 7 Tagen Safari-Nutzung ohne Besuch. Home-Bildschirm-Apps zählen laut WebKit **eigene Nutzungstage**; WebKit erwartet nicht, dass ihre Daten gelöscht werden. |
| Speicherplatz | Home-Bildschirm-App hat dieselbe Quote wie Safari (bis 60 % des Gerätespeichers pro Herkunft). Reicht für Jahre an Darts (1 Mio. Darts ≈ 200 MB). |
| Dauerhafter Speicher | `navigator.storage.persist()` wird bei Home-Bildschirm-Apps laut WebKit nach Heuristik gewährt. Garantiert ist es nicht. |
| **Restrisiken** | 1. **Löschen des App-Symbols löscht alle Daten.** 2. Safari-Tab und Home-Bildschirm-App haben **getrennte** Speicher; was in Safari gespielt wurde, ist in der App nicht da. 3. Bei Speichermangel kann iOS trotzdem räumen, wenn `persist()` nicht gewährt wurde. 4. Gerätewechsel überträgt PWA-Daten nicht zuverlässig. |

**Folge:** Die Annahme stimmt für den Alltag, aber **der Export ist die einzige echte Sicherung**. Daraus folgen die Anforderungen in 13.2–13.4.

### 13.2 Speicher

- IndexedDB-Datenbank `darts`, Tabellen: `events` (nur anfügen), `cache` (abgeleitet, neu baubar), `meta` (Geräte-ID, Einstellungen, Zeitpunkt der letzten Sicherung).
- Beim ersten Start und bei jedem Start `navigator.storage.persist()` anfragen. Ergebnis in den Einstellungen anzeigen („Dauerhafter Speicher: gewährt / nicht gewährt“).
- Hinweis beim ersten Start in Safari (nicht installiert): „Installiere die App auf dem Home-Bildschirm, sonst können Daten verloren gehen. Daten aus Safari und der installierten App sind getrennt.“
- Updates der App werden nie mitten im Spiel aktiviert, sondern mit „Neue Version – jetzt neu laden?“ zwischen Spielen.

### 13.3 Export

- Knopf „Daten sichern“ in den Einstellungen. Erzeugt eine Datei `darts-sicherung-JJJJ-MM-TT-HHMM.json`:

```
{
  "format": "darts-scorer-backup",
  "formatVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-25T15:10:00Z",
  "deviceId": "…",
  "eventCount": 12345,
  "sha256": "Prüfsumme über das Feld events",
  "events": [ … alle Ereignisse, auch widerrufene … ]
}
```

- Weitergabe über das Teilen-Menü des Handys (`navigator.share` mit Datei → „In Dateien sichern“, iCloud, Mail). Wo das nicht geht: normaler Download.
- **Erinnerung:** Nach jedem beendeten Spiel, wenn die letzte Sicherung länger als 7 Tage her ist (oder es noch keine gibt), ein Hinweisband „Letzte Sicherung vor X Tagen – jetzt sichern?“.

### 13.4 Import

- Datei wählen → App prüft: Format, Version, Prüfsumme, jedes Ereignis gültig. Bei Fehlern: Abbruch mit verständlicher Meldung, **nichts wird geändert**.
- Vorschau: „X neue Ereignisse, Y schon vorhanden, Z neue Profile, W neue Spiele.“ Erst nach Bestätigung wird importiert.
- Import ist **nur hinzufügend**: Ereignisse mit unbekannter ID werden angefügt, bekannte übersprungen. Nichts wird überschrieben oder gelöscht.
- Vor jedem Import legt die App automatisch eine Export-Datei des aktuellen Stands zum Herunterladen an („Sicherung vor Import“).
- Phase 5 ergänzt: gleiche Person auf zwei Geräten verknüpfen (`profile.linked`).

---

## 14. Tests und Gegenprüfung

### 14.1 Testarten

| Art | Werkzeug | Inhalt |
|---|---|---|
| Regel-Tests | Vitest | jede Regel aus Kapitel 7 mit konstruierten Dart-Folgen |
| Checkout-Tabelle | Vitest | alle Reste 2–170 gegen die Golden-Liste, plus Eigenschaften (siehe 14.3) |
| Kennzahlen | Vitest | jede Formel aus Kapitel 11 an einem von Hand nachgerechneten Beispiel |
| Ereignisspeicher | Vitest | Rückgängig, Bearbeiten, Export → Import ergibt identischen Zustand, Import zweimal ändert nichts |
| Durchlauf | Playwright | ganzes Leg 501 Double-Out mit 2 Spielern in iPhone- und Pixel-Größe, Hoch- und Querformat, inklusive Rückgängig, Runde bearbeiten und Bust |

### 14.2 Gegenprüfung wie ein Turnierschreiber (Pflicht-Testfälle)

| Nr. | Ausgangslage | Darts | Erwartung |
|---|---|---|---|
| G1 | 501 DO, Rest 32 | S20, S11 | Rest wäre 1 → **Bust**, Rest bleibt 32, Aufnahme endet nach Dart 2 |
| G2 | 501 DO, Rest 32 | T20 | Rest < 0 → **Bust**, Rest 32 |
| G3 | 501 DO, Rest 32 | S16, S16 | Rest 0, aber kein Double → **Bust**, Rest 32 |
| G4 | 501 DO, Rest 32 | D16 | **Checkout** |
| G5 | 501 DO, Rest 50 | DB | **Checkout** (Bullseye gilt als Double) |
| G6 | 501 DO, Rest 25 | SB | Rest 0 ohne Double → **Bust** |
| G7 | 501 SO, Rest 1 | — | Rest 1 erlaubt, S1 = Checkout |
| G8 | 501 SO, Rest 20 | S19 | Rest 1, **kein** Bust |
| G9 | 501 MO, Rest 60 | T20 | **Checkout** (Master-Out) |
| G10 | 501 MO, Rest 3 | S2 | Rest 1 → **Bust** |
| G11 | 501 DI, Start | S20, T20, D10 | Erst D10 zählt: Rest 481 |
| G12 | 501 DI, Start | D20, S20, T20 | Alle zählen: Rest 501 − 40 − 20 − 60 = 381 |
| G13 | 501 DI, Start | DB | Bullseye bringt rein, zählt 50: Rest 451 |
| G14 | 501 DI, noch nicht drin | S20, S20, S20 | Rest bleibt 501, kein Bust |
| G15 | Startwert 40 (frei), DI/DO, noch nicht drin | D10, T20 | D10 bringt rein (Rest 20), T20 → Rest −40 → **Bust**: Rest 40, wieder „nicht drin“ |
| G16 | Checkout-Tabelle DO | Rest 170 | Vorschlag T20 T20 Bull |
| G17 | Checkout-Tabelle DO | Reste 169, 168, 166, 165, 163, 162, 159 | **kein** Vorschlag |
| G18 | Checkout-Tabelle DO | Rest 171 und höher | **kein** Vorschlag |
| G19 | Checkout-Tabelle DO | alle anderen Reste 2–170 | genau ein Vorschlag, Summe = Rest, letzter Dart Double oder Bullseye, höchstens 3 Darts |
| G20 | Checkout DO, 1 Dart übrig, Rest 100 | — | **kein** Vorschlag |
| G21 | Cricket Standard, 2 Spieler, A hat 20 zu, B hat 20 offen | A: T20 | A +60 Punkte |
| G22 | Cricket Standard, A und B haben 20 zu | A: T20 | A +0 Punkte |
| G23 | Cricket Standard, A hat 1 Mark auf 19 | A: T19 | 19 zu, 1 überzähliger Mark → +19 (wenn B offen) |
| G24 | Cricket Cut-Throat, 3 Spieler, A hat 20 zu, B offen, C zu | A: T20 | B +60, A und C +0 |
| G25 | Cricket Cut-Throat, A, B, C: A hat 20 zu, B und C offen | A: S20 | B +20, C +20 |
| G26 | Cricket Standard | A schließt letzte Zahl, A 40 Punkte, B 60 | **kein** Sieg, Spiel läuft |
| G27 | Cricket Standard | A schließt letzte Zahl, A 60, B 60 | **Sieg A** (Gleichstand reicht) |
| G28 | Cricket Cut-Throat | A schließt letzte Zahl, A 20, B 40 | **Sieg A** |
| G29 | Cricket, Bull | A: DB | 2 Marks auf Bull |
| G30 | Cricket, Treffer bis zu = 5 | A: T20, T20 | 20 zu nach 5 Marks, 1 überzähliger Mark |
| G31 | Shanghai Runde 7 | S7, D7, T7 | Shanghai; bei „beendet = ja“ Sieg sofort |
| G32 | Shanghai Runde 7 | T7, T7, D7 | **kein** Shanghai (Single fehlt), Punkte 21+21+14 = 56 |
| G33 | Shanghai Bull-Runde | SB, DB, DB | kein Shanghai möglich, Punkte 125 |
| G34 | Doppeltraining Ziel Bull | SB als Treffer? | Eingabe Treffer bedeutet immer Bullseye; SB = Falsch |
| G35 | Doppeltraining bis Treffer | Treffer mit Dart 1 | Dart 2 geht auf das nächste Ziel |
| G36 | Undo über Weiter | A bestätigt, B noch nichts | Rückgängig hebt erst Weiter auf, dann A's Dart 3 |
| G37 | Undo nach Checkout | letzter Dart war Checkout | Leg wieder offen, Legs-Zähler −1 |
| G38 | Runde bearbeiten erzeugt früheren Checkout | — | Warnung, spätere Darts werden nach Bestätigung verworfen |
| G39 | Count-Up, 2 Runden, A und B | A: T20 T20 T20, dann 0 0 0; B: S20 S20 S20, dann D20 D20 D20 | A 180, B 180 → Gleichstand, beide Sieger, erst nach Bs letzter Aufnahme |
| G40 | Count-Up, 1 Runde | A: DB T19 0 | A 107 Punkte, 3-Dart-Average 107 |
| G41 | X01 501 mit Handicap B = 301 | B: T20 T20 T20 | B Rest 121, A unverändert 501 |
| G42 | Around the Clock, Ring beliebig, ohne Sprünge, Ziel 1 | S1, D2, T5 | Ziel danach 3 (T5 zählt nicht), 2 Treffer |
| G43 | Around the Clock mit Sprüngen, Ziel 1 bzw. Ziel 19 | T1 bzw. D19 | Ziel 4 bzw. fertig: über das Ende hinaus = gewonnen, sofort |
| G44 | Around the Clock nur Doubles bzw. nur Triples mit Bull | S1 bzw. am Ziel Bull: DB | S1 zählt nicht; DB zählt (am Bull gibt es kein Triple) |
| G45 | Bob's 27, Ziel D1 | Falsch, Falsch, Falsch | 27 − 2 = 25 |
| G46 | Bob's 27, Ziel D1 | Treffer, Falsch, Treffer | 27 + 2 + 2 = 31 (kein Abzug, es gab Treffer) |
| G47 | Bob's 27, „ausscheiden = ja“ | D1 bis D5 nur Falsch | 25, 21, 15, 7, −3 → nach D5 ausgeschieden; bei „nein“ geht es mit D6 weiter |
| G48 | Halve-It, Ziel 15, Start 0 | T15, S15, S20 | 45 + 15 = 60 (S20 zählt nicht) |
| G49 | Halve-It, 61 Punkte, Ziel 16 | S20, T19, 0 | kein Treffer → 61 / 2 = 30 (abgerundet) |
| G50 | Halve-It, Ziel „beliebiges Double“ | D5, D20, DB | 10 + 40 + 50 = 100 (Bullseye zählt als Double) |
| G51 | Halve-It, Ziel Bull bzw. „beliebiges Triple“ | SB, DB bzw. T7, DB | 25 + 50 = 75 bzw. 21 (am Bull gibt es kein Triple) |
| G52 | 121, Double-Out, Ziel 121 | T20, T20 (Rest 1) | Bust: Rest zurück auf 121, Aufnahme vorbei, Versuch läuft mit der nächsten Aufnahme weiter |
| G53 | 121, Ziel 121 | T20, T11, D14 | Checkout → Erfolg, nächstes Ziel 122 |
| G54 | 121, 9 Darts, Ziel 125, „Nach Fehlschlag: −1“ | 3 Aufnahmen ohne Checkout | nächstes Ziel 124; bei Ziel 121 bleibt es 121 (nicht unter das Startziel) |
| G55 | 121, 1 Versuch, 2 Spieler | A checkt, B nicht | Spielende nach Bs letztem Versuch, A gewinnt (höchstes Ziel, dann Erfolge) |
| G56 | Killer, Zone Double, 1 Treffer bis Killer, A hat 20, B hat 5 | A: D5, S20, D20 | D5 zählt nicht (noch kein Killer), S20 zählt nicht (kein Double), D20 → A ist Killer |
| G57 | Killer, A ist Killer, B hat 3 Leben | A: D5 bzw. bei Zone „ganzes Segment“: T5 | B 2 Leben (auch das Triple kostet nur 1 Leben) |
| G58 | Killer, A Killer, B 1 Leben, nur noch A und B | A: D5 | B scheidet aus, A gewinnt sofort |
| G59 | Killer, A Killer mit 3 Leben | A: D20 (eigene Zahl) | „kostet ein Leben“ → A 2 Leben; „zählt nicht“ → A 3 Leben |

### 14.3 Eigenschaften der Checkout-Tabelle (für alle drei Out-Arten, 1–3 Darts)

- Summe der Felder = Rest.
- Letzter Dart passt zur Out-Regel.
- Anzahl Darts ≤ verfügbare Darts.
- Es gibt einen Vorschlag genau dann, wenn eine Brute-Force-Suche über alle 62 Felder (S1–S20, D1–D20, T1–T20, SB, DB) einen Weg findet.
- Gleiche Eingabe ergibt immer denselben Vorschlag.

---

## 15. Annahmen ohne Rückfrage und verworfene Alternativen

### 15.1 Entscheidungen mit Gianluca (25.10.2026)

| Frage | Entscheidung |
|---|---|
| Fehlwurf eingeben | Zahlenring antippen **und** Knopf „Daneben“ |
| Bestleistung | je Kennzahl der Rekord, Zwischenstand gegen das Rekord-Leg dieser Kennzahl |
| Shanghai Double-/Triple-Out | **entfällt** (abweichend vom ursprünglichen Auftrag) |
| Ausrichtung | Hoch- und Querformat gleichwertig |
| Spielerwechsel | erst nach „Weiter“ |
| Ausbullen-Gleichstand | immer Abstand zum Mittelpunkt, nur bei exakt gleichem Wert neu werfen |
| Zugweite der Ring-Leiste | 50 Punkte pro Stufe (nach Test am Board, statt 40) |

### 15.2 Annahmen ohne Rückfrage

1. Bust-Darts zählen als tatsächlich geworfene Darts (1–3), nicht pauschal 3.
2. Darts vor dem Double-In zählen in den Average (Punkte 0).
3. Bei Bust in der Aufnahme, in der Double-In gelang, ist der Spieler wieder „nicht drin“.
4. Anwurf rotiert über das ganze Match Leg für Leg, nicht pro Set neu.
5. Bei X01 mit mehr als 2 Spielern endet das Leg mit dem ersten Checkout.
6. Cricket hat keine Rundenbegrenzung.
7. Cricket-MPR zählt nur Marks mit Wirkung.
8. X01-Aufnahmen 80+ bis 180 sind getrennte Bereiche (80–99, 100–119 …).
9. Double-Versuch = Rest vor dem Dart ist mit einem Dart checkbar (gängige Definition).
10. Shanghai: Gleichstand am Ende = geteilter Platz; Rundenstandard 20 (App 1 zeigte 21).
11. Doppeltraining fester Modus: 9 Darts pro Feld als Standard.
12. Zusätzlich zu Ausbullen und Münzwurf gibt es „wie eingetragen“.
13. Runde bearbeiten nur im laufenden Leg.
14. Gäste-Darts werden gespeichert, aber nie ausgewertet.
15. Abgebrochene Spiele zählen in Quoten, nicht in Bestleistungen.
16. Heatmap nach Feldern, nicht nach exakter Tippstelle (die Ring-Wahl erfolgt über die Leiste, die Tippstelle sagt also nichts über den echten Treffpunkt).
17. Regeln für Killer, 121, Halve-It, Around the Clock in der gängigsten Form mit Einstellungen für die häufigsten Abweichungen.
18. Oberfläche auf Deutsch.

### 15.3 Verworfene Alternativen

| Alternative | Warum verworfen |
|---|---|
| Native App (Swift/Kotlin) oder Flutter | App Store bzw. zwei Codebasen; Auftrag verlangt PWA ohne Store. |
| Spielstand statt Einzeldarts speichern | Neue Kennzahlen wären nicht rückwirkend, Zusammenführen hätte Konflikte. |
| localStorage | nur ca. 5 MB, wird von Safari schneller geräumt. |
| React | größer als Preact bei gleicher Schreibweise; Ladezeit am Handy zählt. |
| Svelte | weniger Anleitungen für Einsteiger, andere Denkweise als die meisten Beispiele im Netz. |
| Ring direkt antippen (echte Board-Geometrie) | Double-Ring am Handy nur ca. 8 Punkte dick, viel zu klein. |
| Ring-Leiste unter dem Finger (wie App 1) | Finger verdeckt die Auswahl, ausdrücklich nicht gewünscht. |
| Handgeschriebene Checkout-Tabelle | Tippfehler-Risiko; erzeugte Tabelle + Gegenlesen + Tests ist sicherer. |
| Synchronisation per Supabase jetzt | Server und Schlüssel sind bis Phase 5 ausgeschlossen. |
