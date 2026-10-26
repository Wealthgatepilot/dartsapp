// Spielende (SPEC 5): Ergebnis und Kennzahlen, Revanche oder fertig. Die Tabelle liefert der Modus.

import type { ComponentChildren } from 'preact';

export function MatchEnd({
  winners,
  nameOf,
  children,
  onUndo,
  onRematch,
  onDone,
  doneLabel = 'Fertig',
}: {
  winners: number[];
  nameOf: (slot: number) => string;
  children: ComponentChildren;
  onUndo: () => void;
  /** Fehlt bei Turnierpartien: dort geht es zurück zum Turnier (SPEC 8.5). */
  onRematch?: () => void;
  onDone: () => void;
  doneLabel?: string;
}) {
  const title =
    winners.length === 1
      ? `🏆 ${nameOf(winners[0])} gewinnt`
      : winners.length > 1
        ? `🏆 Gleichstand: ${winners.map(nameOf).join(', ')}`
        : 'Spiel beendet';
  return (
    <div class="modal-backdrop">
      <div class="modal match-end" role="dialog" aria-label="Spielende">
        <header class="modal-head">
          <h2>{title}</h2>
        </header>
        <div class="modal-body">
          {children}
          <div class="row">
            <button class="btn" onClick={onUndo}>
              ↶ Rückgängig
            </button>
            {onRematch && (
              <button class="btn" onClick={onRematch}>
                Revanche
              </button>
            )}
            <button class="btn btn-primary grow" onClick={onDone}>
              {doneLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
