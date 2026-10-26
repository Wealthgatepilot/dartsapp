// Cricket-Ansicht (SPEC 7.2): Tafel mit Marks je Zahl und Spieler, Punkte, Marks pro Runde.

import { useMemo } from 'preact/hooks';
import {
  computeCricket,
  confirmCricketTurn,
  isClosed,
  planCricketEdit,
  throwCricketDart,
  undoCricket,
  type CricketState,
  type CricketTurn,
} from '../../engine/cricket';
import { cricketSetupOf } from '../../engine/games';
import { BULL, fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

/** Marks pro 3 Darts über das ganze Spiel (SPEC 11.3). */
function mpr(state: CricketState, slot: number): string {
  let marks = 0;
  let darts = 0;
  for (const leg of state.legs) {
    for (const t of leg.turns) {
      if (t.slot !== slot) continue;
      marks += t.marks;
      darts += t.darts.length;
    }
  }
  return darts ? ((marks / darts) * 3).toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '—';
}

/** Kreidezeichen: / = 1, X = 2, Ⓧ = zu (bei Trefferzahl 3); sonst „2/5“ bzw. „✓“. */
export function markSymbol(marks: number, closeAt: number): string {
  if (marks >= closeAt) return closeAt === 3 ? 'Ⓧ' : '✓';
  if (closeAt === 3) return ['', '/', 'X'][marks];
  return marks ? `${marks}/${closeAt}` : '';
}

export function CricketGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeCricket(cricketSetupOf(game), gameEvents), [game, gameEvents]);
  const s = state.setup.settings;
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const legWon = turn && state.awaitingConfirm && !state.finished && state.legs[state.legs.length - 1].winner !== null;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      isTarget={(n) => s.targets.includes(n)}
      reserve={150 + 26 * s.targets.length + 170}
      scoreboard={<Tafel state={state} order={game.order} activeSlot={activeSlot} nameOf={nameOf} colorOf={colorOf} />}
      turnDetails={
        <>
          <TurnLine turn={turn} nameOf={nameOf} variant={s.variant} />
          {legWon && <p class="banner">Leg an {nameOf(state.legs[state.legs.length - 1].winner!)}</p>}
        </>
      }
      pillText={(d) => `${fieldLabel(d.field)} · ${d.scored} M`}
      throwDart={(f, input) => throwCricketDart(state, f, input)}
      confirm={() => confirmCricketTurn(state)}
      undo={() => undoCricket(state)}
      planEdit={(t, fields) => planCricketEdit(state, gameEvents, t, fields)}
      summary={(t) => `${(t as CricketTurn).marks} Marks`}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>{s.sets ? 'Sets' : 'Legs'}</th>
              <th>Punkte</th>
              <th>MPR</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                <td>{s.sets ? state.setsWon[slot] : state.legsWon[slot]}</td>
                <td>{state.points[slot]}</td>
                <td>{mpr(state, slot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

function Tafel({
  state,
  order,
  activeSlot,
  nameOf,
  colorOf,
}: {
  state: CricketState;
  order: number[];
  activeSlot: number;
  nameOf: (s: number) => string;
  colorOf: (s: number) => string;
}) {
  const s = state.setup.settings;
  const leg = state.legs[state.legs.length - 1].state;
  return (
    <div class="tafel-wrap">
      <table class="tafel">
        <thead>
          <tr>
            <th />
            {order.map((slot) => (
              <th key={slot} class={slot === activeSlot ? 'active' : ''} style={{ borderColor: colorOf(slot) }}>
                <div class="tafel-head">
                  <span class="score-name">{nameOf(slot)}</span>
                  <span class="tafel-points">{state.points[slot]}</span>
                </div>
                <div class="score-meta">
                  {s.legs.count > 1 || s.sets ? `Legs ${s.sets ? state.legsWonInSet[slot] : state.legsWon[slot]} · ` : ''}
                  MPR {mpr(state, slot)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.targets.map((n) => {
            const dead = order.every((slot) => isClosed(leg, slot, n, s.closeAt));
            return (
              <tr key={n} class={dead ? 'dead' : ''}>
                <th>{n === BULL ? 'B' : n}</th>
                {order.map((slot) => (
                  <td key={slot} class={slot === activeSlot ? 'active' : ''}>
                    {markSymbol(leg.marks[slot][n], s.closeAt)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TurnLine({
  turn,
  nameOf,
  variant,
}: {
  turn: CricketTurn | null;
  nameOf: (s: number) => string;
  variant: 'standard' | 'cutthroat';
}) {
  if (!turn || turn.darts.length === 0) return <div class="calc" />;
  const given = Object.entries(turn.given).map(([slot, pts]) => `+${pts} an ${nameOf(Number(slot))}`);
  return (
    <div class="calc">
      {turn.marks} Marks
      {variant === 'standard' && turn.points > 0 && ` · +${turn.points} Punkte`}
      {variant === 'cutthroat' && given.length > 0 && ` · ${given.join(', ')}`}
    </div>
  );
}
