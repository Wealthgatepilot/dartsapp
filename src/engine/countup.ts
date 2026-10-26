// Count-Up nach SPEC 7.10: jede Aufnahme zählt ihre Punkte, nach der letzten Runde gewinnen die meisten Punkte.

import {
  computeCore,
  confirmTurnCore,
  planEditCore,
  throwDartCore,
  undoCore,
  type CoreState,
  type EditPlan,
  type Rules,
  type Turn as CoreTurn,
} from './core';
import type { DartPayload, GameEvent, NewEvent } from './events';
import { isValidField, points, type Field } from './types';

export interface CountUpSettings {
  /** Rundenzahl 1–50. */
  rounds: number;
}

export const DEFAULT_COUNTUP: CountUpSettings = { rounds: 8 };
export const MAX_COUNTUP_ROUNDS = 50;

export interface CountUpSetup {
  gameId: string;
  settings: CountUpSettings;
  order: number[];
}

export function validateCountUp(s: CountUpSettings): string[] {
  return Number.isInteger(s.rounds) && s.rounds >= 1 && s.rounds <= MAX_COUNTUP_ROUNDS
    ? []
    : [`Rundenzahl 1 bis ${MAX_COUNTUP_ROUNDS}.`];
}

export interface CountUpTurnData {
  points: number;
}

export interface CountUpLegState {
  points: Record<number, number>;
}

export type CountUpTurn = CoreTurn<CountUpTurnData>;
export type CountUpState = CoreState<CountUpLegState, CountUpTurnData> & {
  setup: CountUpSetup;
  points: Record<number, number>;
};

function countUpRules(setup: CountUpSetup): Rules<CountUpLegState, CountUpTurnData> {
  const { settings: s, order } = setup;
  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({ points: Object.fromEntries(order.map((p) => [p, 0])) }),
    newTurn: () => ({ points: 0 }),
    applyDart: (ls, turn, d) => {
      const pts = points(d.field!);
      ls.points[turn.slot] += pts;
      turn.points += pts;
      return { scored: pts, endsTurn: false };
    },
    winners: (ls, at) => {
      if (!(at.afterTurn && at.lastInRound && at.round >= s.rounds)) return null;
      const best = Math.max(...order.map((p) => ls.points[p]));
      return order.filter((p) => ls.points[p] === best);
    },
  };
}

export function computeCountUp(setup: CountUpSetup, events: readonly GameEvent[]): CountUpState {
  const core = computeCore(countUpRules(setup), events);
  return { ...core, setup, points: core.legs[0].state.points };
}

export function throwCountUpDart(state: CountUpState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmCountUpTurn(state: CountUpState): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoCountUp(state: CountUpState): NewEvent[] {
  return undoCore(state);
}

export function planCountUpEdit(
  state: CountUpState,
  events: readonly GameEvent[],
  target: { leg: number; slot: number; turnIndex: number },
  fields: Field[],
): EditPlan {
  if (!fields.every(isValidField)) return { events: [], discarded: [], outcomeChanged: false, error: 'Ungültiges Feld.' };
  return planEditCore(
    state,
    {},
    events,
    target,
    fields.map((field) => ({ field })),
    (evs) => computeCountUp(state.setup, evs),
    () => '',
  );
}

/** 3-Dart-Average eines Spielers (SPEC 7.10), null ohne Darts. */
export function countUpAverage(state: CountUpState, slot: number): number | null {
  const turns = state.legs[0].turns.filter((t) => t.slot === slot);
  const darts = turns.reduce((n, t) => n + t.darts.length, 0);
  return darts ? (state.points[slot] / darts) * 3 : null;
}
