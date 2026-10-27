// Spielende (SPEC 5): Ergebnis und Kennzahlen, Revanche oder fertig. Die Tabelle liefert der Modus.

import type { ComponentChildren } from 'preact';

export function MatchEnd({
  winners,
  places,
  nameOf,
  children,
  onUndo,
  onRematch,
  onDone,
  doneLabel = 'Fertig',
}: {
  winners: number[];
  /** Plätze nach dem Weiterspielen (SPEC 5.0); null = keine Platzierung. */
  places?: number[][] | null;
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
          {places && places.length > 1 && (
            <ol class="places">
              {places.map((group, i) => (
                <li key={i}>
                  <b>{1 + places.slice(0, i).flat().length}.</b> {group.map(nameOf).join(', ')}
                </li>
              ))}
            </ol>
          )}
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
