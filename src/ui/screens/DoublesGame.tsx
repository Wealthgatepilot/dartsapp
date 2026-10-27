// Doppelfeld-Training (SPEC 7.4): Ziel je Spieler, Darts aufs Ziel und gesamt, Quote bei Treffer und gesamt, Eingabe über drei Flächen.

import { useMemo } from 'preact/hooks';
import {
  computeDoubles,
  confirmDoublesTurn,
  currentTarget,
  quote,
  targetsOf,
  throwDoublesDart,
  undoDoubles,
  type DoublesState,
} from '../../engine/doubles';
import { doublesSetupOf } from '../../engine/games';
import { fieldLabel } from '../../engine/types';
import { type Block, PlayerBlocks } from '../blocks';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

export function DoublesGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeDoubles(doublesSetupOf(game), gameEvents), [game, gameEvents]);
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const target = currentTarget(state.players[activeSlot]);

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      scoreboard={<Cards state={state} order={game.order} activeSlot={activeSlot} nameOf={nameOf} colorOf={colorOf} />}
      turnDetails={<History state={state} slot={activeSlot} />}
      pillText={(d) => (d.hit ? `${fieldLabel(d.field)} ✓` : 'Falsch')}
      confirm={() => confirmDoublesTurn(state)}
      undo={() => undoDoubles(state)}
      hitMiss={{
        targetLabel: target ? fieldLabel(target) : '—',
        onHit: (input) => throwDoublesDart(state, true, input),
        onMiss: (input) => throwDoublesDart(state, false, input),
      }}
      endTable={<Results state={state} order={game.order} nameOf={nameOf} />}
    />
  );
}

function Cards({
  state,
  order,
  activeSlot,
  nameOf,
  colorOf,
}: {
  state: DoublesState;
  order: number[];
  activeSlot: number;
  nameOf: (s: number) => string;
  colorOf: (s: number) => string;
}) {
  const blocks: Block[] = order.map((slot) => {
    const p = state.players[slot];
    const t = currentTarget(p);
    const onTarget = t ? (p.stats[fieldLabel(t)] ?? { darts: 0, hits: 0 }) : null;
    return {
      slot,
      name: nameOf(slot),
      color: colorOf(slot),
      big: t ? fieldLabel(t) : '✓',
      badge: String(p.index),
      badgeLabel: 'Felder geschafft',
      pages: [
        [
          { label: 'Ziel', value: `${Math.min(p.index + 1, p.sequence.length)}/${p.sequence.length}` },
          { label: t ? `Darts auf ${fieldLabel(t)}` : 'Darts auf Ziel', value: t ? String(p.dartsOnTarget) : '—' },
          { label: 'Darts gesamt', value: String(p.darts) },
          // Quote auf dem aktuellen Ziel, falls der nächste Dart trifft
          { label: 'Bei Treffer', value: onTarget ? quote(onTarget.hits + 1, onTarget.darts + 1) : '—' },
          { label: 'Quote', value: quote(p.hits, p.darts) },
        ],
      ],
    };
  });
  return <PlayerBlocks blocks={blocks} activeSlot={activeSlot} />;
}

/** Die letzten Ziele des Spielers mit den nötigen Darts (wie die Verlaufstabelle in App 2). */
function History({ state, slot }: { state: DoublesState; slot: number }) {
  const last = state.players[slot].history.slice(-4).reverse();
  if (!last.length) return null;
  return (
    <div class="history-line small muted">
      {last.map((h) => `${fieldLabel(h.target)}: ${h.darts} ${h.darts === 1 ? 'Dart' : 'Darts'}`).join(' · ')}
    </div>
  );
}

/**
 * Ergebnis je Spieler und Feld (SPEC 7.4, Regel 7). Bei vielen Feldern zwei Tabellen: im Querformat
 * nebeneinander, im Hochformat untereinander wie eine (Wunsch Gianluca: alles ohne Scrollen sehen).
 */
function Results({ state, order, nameOf }: { state: DoublesState; order: number[]; nameOf: (s: number) => string }) {
  const keys = targetsOf(state.setup.settings).map(fieldLabel);
  // Bis zu drei Teile mit etwa gleich vielen Zeilen; die Gesamt-Zeile zählt im ersten Teil mit.
  const per = keys.length > 6 ? Math.ceil((keys.length + 1) / 3) : keys.length + 1;
  const parts = [keys.slice(0, per - 1), keys.slice(per - 1, 2 * per - 1), keys.slice(2 * per - 1)].filter(
    (p, i) => i === 0 || p.length,
  );
  return (
    <div class="results-fit">
      {parts.map((part, i) => (
        <table key={i} class="table results-table">
          <thead>
            <tr>
              <th>Feld</th>
              {order.map((slot) => (
                <th key={slot}>{nameOf(slot)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {i === 0 && (
              <tr>
                <td>
                  <strong>Gesamt</strong>
                </td>
                {order.map((slot) => {
                  const p = state.players[slot];
                  return (
                    <td key={slot}>
                      <strong>
                        {p.hits}/{p.darts} · {quote(p.hits, p.darts)}
                      </strong>
                    </td>
                  );
                })}
              </tr>
            )}
            {part.map((key) => (
              <tr key={key}>
                <td>{key}</td>
                {order.map((slot) => {
                  const st = state.players[slot].stats[key];
                  return <td key={slot}>{st ? `${st.hits}/${st.darts} · ${quote(st.hits, st.darts)}` : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
