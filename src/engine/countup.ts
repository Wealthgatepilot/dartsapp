// Count-Up nach SPEC 7.10: jede Aufnahme zählt ihre Punkte. Begrenzt durch Runden oder Zeit,
// gewertet gegeneinander oder zusammen als Team.

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
import { voidedIds, type DartPayload, type GameEvent, type NewEvent } from './events';
import { isValidField, points, type Field } from './types';

export interface CountUpSettings {
  /** Rundenzahl 1–50 (bei Begrenzung „Runden“). */
  rounds: number;
  /** Runden (Standard, fehlt bei älteren Spielen) oder Zeit (Wunsch Gianluca, 09.11.2026). */
  limit?: 'rounds' | 'time';
  /** Minuten bei Begrenzung „Zeit“, 5–180. */
  minutes?: number;
  /** Gegeneinander (Standard) oder zusammen als Team. */
  scoring?: 'versus' | 'team';
}

export const DEFAULT_COUNTUP: CountUpSettings = { rounds: 8, limit: 'rounds', minutes: 60, scoring: 'versus' };
export const MAX_COUNTUP_ROUNDS = 50;
export const COUNTUP_MINUTES = { min: 5, max: 180, step: 5 };

export const isTimed = (s: CountUpSettings) => s.limit === 'time';

/** „8 Runden“ bzw. „60 Min“ für Titel und Vergleichsgruppe. */
export function countUpLimitLabel(s: CountUpSettings): string {
  if (isTimed(s)) return `${s.minutes ?? 60} Min`;
  return s.rounds === 1 ? '1 Runde' : `${s.rounds} Runden`;
}

export interface CountUpSetup {
  gameId: string;
  settings: CountUpSettings;
  order: number[];
}

export function validateCountUp(s: CountUpSettings): string[] {
  if (isTimed(s)) {
    const m = s.minutes ?? 0;
    return Number.isInteger(m) && m >= COUNTUP_MINUTES.min && m <= COUNTUP_MINUTES.max
      ? []
      : [`Zeit ${COUNTUP_MINUTES.min} bis ${COUNTUP_MINUTES.max} Minuten.`];
  }
  return Number.isInteger(s.rounds) && s.rounds >= 1 && s.rounds <= MAX_COUNTUP_ROUNDS
    ? []
    : [`Rundenzahl 1 bis ${MAX_COUNTUP_ROUNDS}.`];
}

/** „Zeit abgelaufen“: nach dieser Runde ist Schluss (erste gültige Antwort zählt). */
function timeUpRound(gameId: string, events: readonly GameEvent[]): number | null {
  const voided = voidedIds(events);
  for (const e of events) {
    if (e.type === 'game.decision' && !voided.has(e.id) && e.payload.gameId === gameId && e.payload.kind === 'timeUp') {
      return e.payload.lastRound;
    }
  }
  return null;
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
  /** Bei Begrenzung „Zeit“: Zeit abgelaufen, die laufende Runde wird noch zu Ende gespielt. */
  timeUp: boolean;
};

function countUpRules(setup: CountUpSetup, lastTimedRound: number | null): Rules<CountUpLegState, CountUpTurnData> {
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
      const last = isTimed(s) ? (lastTimedRound ?? Infinity) : s.rounds;
      if (!(at.afterTurn && at.lastInRound && at.round >= last)) return null;
      // Zusammen: alle teilen sich das Team-Ergebnis
      if (s.scoring === 'team') return [...order];
      const best = Math.max(...order.map((p) => ls.points[p]));
      return order.filter((p) => ls.points[p] === best);
    },
  };
}

export function computeCountUp(setup: CountUpSetup, events: readonly GameEvent[]): CountUpState {
  const lastTimedRound = isTimed(setup.settings) ? timeUpRound(setup.gameId, events) : null;
  const core = computeCore(countUpRules(setup, lastTimedRound), events);
  return { ...core, setup, points: core.legs[0].state.points, timeUp: lastTimedRound !== null };
}

/** Uhr bei Begrenzung „Zeit“ (SPEC 7.10), aus den Uhrzeiten der Ereignisse. */
export interface CountUpClock {
  /** Erster Dart geworfen: Die Uhr läuft (oder ist angehalten). */
  started: boolean;
  paused: boolean;
  elapsedMs: number;
  remainingMs: number;
}

/** Verstrichene Zeit seit dem ersten Dart, ohne Pausen. Rückgängig ändert an der Uhr nichts. */
export function countUpClock(setup: CountUpSetup, events: readonly GameEvent[], now: number): CountUpClock {
  const total = (setup.settings.minutes ?? 60) * 60_000;
  const mine = events.filter((e) => 'gameId' in e.payload && e.payload.gameId === setup.gameId);
  const first = mine.find((e) => e.type === 'dart.thrown');
  if (!first) return { started: false, paused: false, elapsedMs: 0, remainingMs: total };
  const voided = voidedIds(events);
  let elapsed = 0;
  let runningSince: number | null = first.ts;
  for (const e of mine) {
    if (e.type !== 'game.decision' || voided.has(e.id) || e.ts < first.ts) continue;
    if (e.payload.kind === 'pause' && runningSince !== null) {
      elapsed += e.ts - runningSince;
      runningSince = null;
    } else if (e.payload.kind === 'resume' && runningSince === null) {
      runningSince = e.ts;
    }
  }
  if (runningSince !== null) elapsed += Math.max(0, now - runningSince);
  return { started: true, paused: runningSince === null, elapsedMs: elapsed, remainingMs: Math.max(0, total - elapsed) };
}

/** Wo die Antwort hingehört: an die Aufnahme, die gerade dran ist oder auf „Weiter“ wartet. */
function at(state: CountUpState): { slot: number; turnIndex: number } {
  const pos = state.next ?? state.currentTurn;
  return pos ? { slot: pos.slot, turnIndex: pos.turnIndex } : { slot: state.order[0], turnIndex: 1 };
}

/** Uhr anhalten bzw. weiterlaufen lassen. */
export function pauseCountUp(state: CountUpState, pause: boolean): NewEvent[] {
  return [{ type: 'game.decision', payload: { gameId: state.gameId, ...at(state), kind: pause ? 'pause' : 'resume' } }];
}

/**
 * Zeit abgelaufen: Eine angefangene Aufnahme wird zu Ende geworfen, die Runde zu Ende gespielt.
 * Beginnt gerade eine neue Runde (der Erste ist dran, noch kein Dart), ist nach der vorigen Schluss.
 */
export function timeUpCountUp(state: CountUpState): NewEvent[] {
  if (state.timeUp || state.finished) return [];
  const pos = state.next;
  let lastRound: number;
  if (pos) {
    const newRound = pos.dartIndex === 1 && pos.slot === state.order[0];
    lastRound = newRound ? pos.turnIndex - 1 : pos.turnIndex;
  } else {
    lastRound = state.currentTurn?.turnIndex ?? 1;
  }
  return [{ type: 'game.decision', payload: { gameId: state.gameId, ...at(state), kind: 'timeUp', lastRound: Math.max(1, lastRound) } }];
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
