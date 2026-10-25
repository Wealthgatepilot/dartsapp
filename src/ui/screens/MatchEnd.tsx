// Match-Ende (SPEC 5): Ergebnis und Kennzahlen, Revanche oder fertig.

import { formatAverage, matchNumbers } from '../../engine/stats';
import type { X01State } from '../../engine/x01';

export function MatchEnd({
  state,
  order,
  nameOf,
  onUndo,
  onRematch,
  onDone,
}: {
  state: X01State;
  order: number[];
  nameOf: (slot: number) => string;
  onUndo: () => void;
  onRematch: () => void;
  onDone: () => void;
}) {
  const sets = state.setup.settings.sets;
  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-label="Spielende">
        <header class="modal-head">
          <h2>🏆 {nameOf(state.matchWinner!)} gewinnt</h2>
        </header>
        <div class="modal-body">
          <table class="table">
            <thead>
              <tr>
                <th>Spieler</th>
                <th>{sets ? 'Sets' : 'Legs'}</th>
                <th>Ø</th>
                <th>Darts</th>
                <th>Höchster Checkout</th>
              </tr>
            </thead>
            <tbody>
              {order.map((slot) => {
                const n = matchNumbers(state.legs, slot);
                return (
                  <tr key={slot}>
                    <td>{nameOf(slot)}</td>
                    <td>{sets ? state.setsWon[slot] : state.legsWon[slot]}</td>
                    <td>{formatAverage(n.average)}</td>
                    <td>{n.darts}</td>
                    <td>{n.highestCheckout ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
