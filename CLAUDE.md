# CLAUDE.md – Arbeitsregeln für dieses Projekt

Private Darts-Scorer-App (das Spiel, nicht die Programmiersprache Dart) als installierbare Web-App (PWA). Verbindliche Beschreibung: `SPEC.md`. Phasen: `ROADMAP.md`. Bedien-Vorbilder: `referenz/`.

## Mit Gianluca arbeiten

- Gianluca ist Programmier-Einsteiger. Bei jeder Entscheidung zuerst die Logik in einfachen Worten erklären, dann die Schritte.
- Vor jeder Phase einen Plan zeigen und auf Freigabe warten.
- Am Ende jeder Phase in `ROADMAP.md` festhalten: Annahmen ohne Rückfrage, verworfene Alternativen.
- Weicht etwas von `SPEC.md` ab, zuerst die SPEC ändern (mit Gianluca), dann den Code.

## Grenzen (nicht verhandelbar)

- **Keine Dateien und keine gespeicherten Spieldaten löschen oder überschreiben ohne Gianlucas Freigabe.** Statistiken über Monate sind nicht wiederherstellbar.
- Ereignisse im Speicher sind unveränderlich. Korrekturen nur als neue Ereignisse (`event.voided`, `replaces`). Formatänderungen nur durch Übersetzen beim Lesen, nie durch Umschreiben.
- Import ist nur hinzufügend.
- Keine Logos, Namen, Markengrafiken oder Board-Beschriftungen aus den Referenz-Apps übernehmen. Bedienmuster ja.
- Bis Phase 5: kein Server, keine Konten, keine Zugangsschlüssel in der App.

## Technik

- TypeScript, Vite, Preact, Dexie (IndexedDB), vite-plugin-pwa, Vitest, Playwright. Auslieferung über GitHub Pages.
- `src/engine/` enthält nur reine Spiellogik ohne Oberfläche, Speicher oder Browser-Zugriffe. Zustand = Ergebnis der Ereignisliste.
- Board-Eingabe: Ring-Leiste nie unter dem Finger; Trefferflächen mindestens 44 Punkte.
- Optik in Phase 1 und 2 schlicht; keine Animationen vor Phase 3.

## Fertig heißt

- Alle Tests grün, Ausgabe Gianluca gezeigt (`npm test`, `npm run e2e`).
- Gegenprüfungsfälle aus SPEC 14.2 sind als Tests vorhanden.
- Checkout-Tabelle gegen alle Reste 2–170 getestet.
- Playwright spielt ein ganzes Leg in iPhone- und Android-Größe, Hoch- und Querformat.
- Gianluca hat am Board auf iPhone und Android getestet.
