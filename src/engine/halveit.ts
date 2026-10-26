// Halve-It nach SPEC 7.9: je Ziel eine Aufnahme; ohne Treffer werden die Gesamtpunkte halbiert.

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
import { BULL, isValidField, points, type Field } from './types';

/** Ein Ziel: eine Zahl 1–20, das Bull (25), ein beliebiges Double ('D') oder Triple ('T'). */
export type HalveTarget = number | 'D' | 'T';

export interface HalveItSettings {
  targets: HalveTarget[];
  /** Startpunkte 0–100. */
  startPoints: number;
}

export const DEFAULT_HALVEIT: HalveItSettings = { targets: [15, 16, 'D', 17, 18, 'T', 19, 20, BULL], startPoints: 0 };
export const MAX_HALVEIT_TARGETS = 30;

export interface HalveItSetup {
  gameId: string;
  settings: HalveItSettings;
  order: number[];
}

export function halveTargetName(t: HalveTarget): string {
  return t === 'D' ? 'Double' : t === 'T' ? 'Triple' : t === BULL ? 'Bull' : String(t);
}

export function validateHalveIt(s: HalveItSettings): string[] {
  const errors: string[] = [];
  if (s.targets.length < 1 || s.targets.length > MAX_HALVEIT_TARGETS) errors.push(`1 bis ${MAX_HALVEIT_TARGETS} Ziele.`);
  if (!s.targets.every((t) => t === 'D' || t === 'T' || t === BULL || (Number.isInteger(t) && t >= 1 && t <= 20))) {
    errors.push('Ungültiges Ziel.');
  }
  if (!Number.isInteger(s.startPoints) || s.startPoints < 0 || s.startPoints > 100) errors.push('Startpunkte 0 bis 100.');
  return errors;
}

/** Punkte eines Darts auf dieses Ziel (0 = kein Treffer). Das Bullseye zählt als Double. */
export function halveScore(t: HalveTarget, f: Field): number {
  if (f.m === 0) return 0;
  if (t === 'D') return f.m === 2 ? points(f) : 0;
  if (t === 'T') return f.m === 3 ? points(f) : 0;
  return f.n === t ? points(f) : 0;
}

/** Zählt die Zahl n auf dem Board für dieses Ziel (für die Farben)? */
export function halveIsTarget(t: HalveTarget, n: number): boolean {
  if (t === 'D') return true;
  if (t === 'T') return n !== BULL;
  return n === t;
}

export interface HalveItTurnData {
  target: HalveTarget;
  points: number;
  hits: number;
  /** Halbiert nach dieser Aufnahme (kein Treffer). */
  halved: boolean;
  /** Punkte vor der Aufnahme. */
  before: number;
}

export interface HalveItLegState {
  points: Record<number, number>;
}

export type HalveItTurn = CoreTurn<HalveItTurnData>;
export type HalveItState = CoreState<HalveItLegState, HalveItTurnData> & {
  setup: HalveItSetup;
  points: Record<number, number>;
  /** Ziel der laufenden Runde, null nach dem Spiel. */
  target: HalveTarget | null;
};

function halveItRules(setup: HalveItSetup): Rules<HalveItLegState, HalveItTurnData> {
  const { settings: s, order } = setup;
  const rounds = s.targets.length;
  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({ points: Object.fromEntries(order.map((p) => [p, s.startPoints])) }),
    newTurn: (ls, slot, round) => ({
      target: s.targets[round - 1],
      points: 0,
      hits: 0,
      halved: false,
      before: ls.points[slot],
    }),
    applyDart: (ls, turn, d, dartIndex) => {
      const pts = halveScore(turn.target, d.field!);
      if (pts) {
        turn.hits++;
        turn.points += pts;
        ls.points[turn.slot] += pts;
      }
      // Abgerechnet wird nach dem dritten Dart: ohne Treffer halbieren (abgerundet)
      if (dartIndex === 3 && turn.hits === 0) {
        turn.halved = true;
        ls.points[turn.slot] = Math.floor(ls.points[turn.slot] / 2);
      }
      return { scored: pts, endsTurn: false };
    },
    winners: (ls, at) => {
      if (!(at.afterTurn && at.lastInRound && at.round >= rounds)) return null;
      const best = Math.max(...order.map((p) => ls.points[p]));
      return order.filter((p) => ls.points[p] === best);
    },
  };
}

export function computeHalveIt(setup: HalveItSetup, events: readonly GameEvent[]): HalveItState {
  const core = computeCore(halveItRules(setup), events);
  const round = core.next?.turnIndex ?? core.currentTurn?.turnIndex;
  return {
    ...core,
    setup,
    points: core.legs[0].state.points,
    target: round && !core.finished ? setup.settings.targets[round - 1] : null,
  };
}

export function throwHalveItDart(state: HalveItState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmHalveItTurn(state: HalveItState): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoHalveIt(state: HalveItState): NewEvent[] {
  return undoCore(state);
}

export function planHalveItEdit(
  state: HalveItState,
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
    (evs) => computeHalveIt(state.setup, evs),
    (t) => String(t.halved),
  );
}
