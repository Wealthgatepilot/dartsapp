// Spielende (SPEC 5): Ergebnis und Kennzahlen, Revanche oder fertig. Die Tabelle liefert der Modus.

import type { ComponentChildren } from 'preact';

export function MatchEnd({
  winners,
  nameOf,
  children,
  onUndo,
  onRematch,
  onDone,
}: {
  winners: number[];
  nameOf: (slot: number) => string;
  children: ComponentChildren;
  onUndo: () => void;
  onRematch: () => void;
  onDone: () => void;
}) {
  const title =
    winners.length === 1
      ? `🏆 ${nameOf(winners[0])} gewinnt`
      : winners.length > 1
        ? `🏆 Gleichstand: ${winners.map(nameOf).join(', ')}`
        : 'Spiel beendet';
  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-label="Spielende">
        <header class="modal-head">
          <h2>{title}</h2>
        </header>
        <div class="modal-body">
          {children}
          <div class="row">
            <button class="btn" onClick={onUndo}>
              ↶ Rückgängig
            </button>
            <button class="btn" onClick={onRematch}>
              Revanche
            </button>
            <button class="btn btn-primary grow" onClick={onDone}>
              Fertig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
