// Doppelfeld-Training (SPEC 7.4): Ziel je Spieler, Getroffen/Falsch/Darts/Quote, Eingabe über drei Flächen.

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
        onHit: () => throwDoublesDart(state, true),
        onMiss: () => throwDoublesDart(state, false),
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
  return (
    <div class="scoreboard">
      {order.map((slot) => {
        const p = state.players[slot];
        const t = currentTarget(p);
        return (
          <div
            key={slot}
            class={slot === activeSlot ? 'score-card active' : 'score-card'}
            style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
          >
            <div class="score-name">
              <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
            </div>
            <div class="score-rest">{t ? fieldLabel(t) : '✓'}</div>
            <div class="score-meta">
              {p.hits} getroffen · {p.darts - p.hits} falsch · {p.darts} Darts
            </div>
            <div class="score-meta">
              Quote {quote(p.hits, p.darts)} · Ziel {Math.min(p.index + 1, p.sequence.length)}/{p.sequence.length}
            </div>
          </div>
        );
      })}
    </div>
  );
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

/** Ergebnis je Spieler und Feld (SPEC 7.4, Regel 7). */
function Results({ state, order, nameOf }: { state: DoublesState; order: number[]; nameOf: (s: number) => string }) {
  return (
    <div class="results-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>Feld</th>
            {order.map((slot) => (
              <th key={slot}>{nameOf(slot)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
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
          {targetsOf(state.setup.settings).map((f) => {
            const key = fieldLabel(f);
            return (
              <tr key={key}>
                <td>{key}</td>
                {order.map((slot) => {
                  const st = state.players[slot].stats[key];
                  return <td key={slot}>{st ? `${st.hits}/${st.darts} · ${quote(st.hits, st.darts)}` : '—'}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
