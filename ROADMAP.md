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
- [ ] **Haltepunkt 4: Test am Board auf iPhone und Android** (`docs/PRUEFLISTE-PHASE1.md`)

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

## Phase 3 – Weitere Modi und Komfort

- Around the Clock, Killer, 121, Bob's 27, Halve-It, Count-Up
- Handicap über Startwerte
- Sprachausgabe
- Computergegner Stufe 1–10 (Kalibrierung per Simulation)
- Optik verfeinern

## Phase 4 – Turnier

- K.-o. mit Freilosen, Jeder gegen jeden, Gruppen + K.-o.
- Turnierbaum und Tabellen

## Phase 5 – Daten mehrerer Geräte

- Import mit Zusammenführen, Profile verknüpfen (`profile.linked`)
- Danach Entscheidung durch Gianluca, ob echte Synchronisation (z. B. Supabase) kommt
