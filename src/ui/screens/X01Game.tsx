// X01-Ansicht (SPEC 7.1): Reste, Rechenzeile, Bust, Checkout-Vorschlag.

import { useMemo } from 'preact/hooks';
import { alternativeCheckout, formatCheckout, suggestCheckout, type AdviceLevel } from '../../engine/checkout';
import { x01SetupOf } from '../../engine/games';
import { x01LegMetrics } from '../../engine/metrics';
import { formatAverage, legNumbers, matchNumbers, turnScore } from '../../engine/stats';
import { fieldLabel, points } from '../../engine/types';
import { computeX01, confirmTurn, planEdit, throwDart, undo, type Turn, type X01State } from '../../engine/x01';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

export function X01Game({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeX01(x01SetupOf(game), gameEvents), [game, gameEvents]);
  if (game.created.mode !== 'x01') return null;
  const advice = game.created.advice;
  const turn = state.currentTurn;
  const leg = state.legs[state.legs.length - 1];
  const legWon = turn?.checkout && state.awaitingConfirm && !state.finished;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      scoreboard={<Scoreboard state={state} order={game.order} activeSlot={activeSlot} nameOf={nameOf} colorOf={colorOf} />}
      turnDetails={
        <>
          <TurnLine turn={turn} state={state} />
          <CheckoutHint state={state} advice={advice} />
          {legWon && (
            <p class="banner">
              Leg an {nameOf(turn!.slot)} · {legNumbers(leg, turn!.slot).darts} Darts · Average{' '}
              {formatAverage(legNumbers(leg, turn!.slot).average)}
            </p>
          )}
        </>
      }
      pillText={(d) => `${fieldLabel(d.field)} · ${points(d.field)}`}
      throwDart={(f) => throwDart(state, f)}
      confirm={() => confirmTurn(state)}
      undo={() => undo(state)}
      planEdit={(t, fields) => planEdit(state, gameEvents, t, fields)}
      summary={(t) => ((t as Turn).bust ? 'Bust' : String(turnScore(t as Turn)))}
      endTable={<EndTable state={state} order={game.order} nameOf={nameOf} />}
    />
  );
}

function Scoreboard({
  state,
  order,
  activeSlot,
  nameOf,
  colorOf,
}: {
  state: X01State;
  order: number[];
  activeSlot: number;
  nameOf: (s: number) => string;
  colorOf: (s: number) => string;
}) {
  const sets = state.setup.settings.sets;
  return (
    <div class="scoreboard">
      {order.map((slot) => {
        const match = matchNumbers(state.legs, slot);
        return (
          <div
            key={slot}
            class={slot === activeSlot ? 'score-card active' : 'score-card'}
            style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
          >
            <div class="score-name">
              <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
            </div>
            <div class="score-rest">{state.remaining[slot]}</div>
            <div class="score-meta">
              {sets ? `Sets ${state.setsWon[slot]} · ` : ''}Legs {sets ? state.legsWonInSet[slot] : state.legsWon[slot]} · Ø{' '}
              {formatAverage(match.average)}
            </div>
            {!state.isIn[slot] && <div class="score-meta">noch nicht drin</div>}
          </div>
        );
      })}
    </div>
  );
}

function TurnLine({ turn, state }: { turn: Turn | null; state: X01State }) {
  if (!turn || turn.darts.length === 0) {
    const slot = state.next?.slot;
    return <div class="calc">{slot !== undefined ? `Rest ${state.remaining[slot]}` : ''}</div>;
  }
  if (turn.bust) return <div class="calc calc-bust">BUST · bleibt {turn.startRemaining}</div>;
  return (
    <div class="calc">
      {turn.startRemaining} − {turnScore(turn)} = <strong>{turn.endRemaining}</strong>
      {turn.checkout && ' · Checkout!'}
    </div>
  );
}

function CheckoutHint({ state, advice }: { state: X01State; advice: AdviceLevel }) {
  const pos = state.next;
  if (!pos || advice === 'off' || !state.isIn[pos.slot]) return null;
  const rest = state.remaining[pos.slot];
  const dartsLeft = 4 - pos.dartIndex;
  const out = state.setup.settings.outMode;
  const main = suggestCheckout(rest, dartsLeft, out, advice);
  if (!main) return null;
  const alt = alternativeCheckout(rest, dartsLeft, out, advice);
  return (
    <div class="checkout">
      <span class="checkout-main">{formatCheckout(main)}</span>
      {alt && <span class="checkout-alt">oder {formatCheckout(alt)}</span>}
    </div>
  );
}

/** Aufnahmen 80–99 … 180 je Spieler über das ganze Match (Wunsch Gianluca). */
const BUCKETS = [
  { key: 's80', label: '80+' },
  { key: 's100', label: '100+' },
  { key: 's120', label: '120+' },
  { key: 's140', label: '140+' },
  { key: 's160', label: '160+' },
  { key: 's180', label: '180' },
] as const;

function MatchCounts({ state, order, nameOf }: { state: X01State; order: number[]; nameOf: (s: number) => string }) {
  const totals = (slot: number) => {
    const t = { s80: 0, s100: 0, s120: 0, s140: 0, s160: 0, s180: 0 };
    for (const leg of state.legs) {
      const m = x01LegMetrics(leg, slot, state.setup.settings.outMode);
      for (const b of BUCKETS) t[b.key] += m[b.key];
    }
    return t;
  };
  return (
    <>
      <h3 class="subhead">Aufnahmen im Match</h3>
      <table class="table table-compact match-counts">
        <thead>
          <tr>
            <th>Spieler</th>
            {BUCKETS.map((b) => (
              <th key={b.key}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((slot) => {
            const t = totals(slot);
            return (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key}>{t[b.key]}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted small">80+ heißt 80–99, 100+ heißt 100–119 usw.; jede Aufnahme zählt in genau einem Bereich.</p>
    </>
  );
}

function EndTable({ state, order, nameOf }: { state: X01State; order: number[]; nameOf: (s: number) => string }) {
  return (
    <>
      <MatchTable state={state} order={order} nameOf={nameOf} />
      <MatchCounts state={state} order={order} nameOf={nameOf} />
    </>
  );
}

function MatchTable({ state, order, nameOf }: { state: X01State; order: number[]; nameOf: (s: number) => string }) {
  const sets = state.setup.settings.sets;
  return (
    <table class="table match-table">
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
  );
}
