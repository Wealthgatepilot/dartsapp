// Cricket nach SPEC 7.2: Standard und Cut-Throat, freie Zielzahlen, einstellbare Trefferzahl.

import {
  computeCore,
  confirmTurnCore,
  planEditCore,
  throwDartCore,
  undoCore,
  type CoreState,
  type EditPlan,
  type Leg as CoreLeg,
  type Race,
  type Rules,
  type Turn as CoreTurn,
} from './core';
import type { DartPayload, GameEvent, NewEvent } from './events';
import { BULL, isValidField, type Field } from './types';

export interface CricketSettings {
  /** Zielzahlen aus 1–20 und 25 (Bull). */
  targets: number[];
  /** Treffer, bis eine Zahl zu ist (1–9). */
  closeAt: number;
  variant: 'standard' | 'cutthroat';
  legs: Race;
  sets: Race | null;
}

export const DEFAULT_CRICKET: CricketSettings = {
  targets: [20, 19, 18, 17, 16, 15, BULL],
  closeAt: 3,
  variant: 'standard',
  legs: { count: 1, kind: 'firstTo' },
  sets: null,
};

export interface CricketSetup {
  gameId: string;
  settings: CricketSettings;
  order: number[];
}

export interface CricketTurnData {
  /** Zählende Marks dieser Aufnahme (schließen oder bringen Punkte, SPEC 11.3). */
  marks: number;
  /** Punkte, die der Werfer in dieser Aufnahme bekommen hat (Standard). */
  points: number;
  /** Punkte, die Gegner in dieser Aufnahme bekommen haben (Cut-Throat). */
  given: Record<number, number>;
  /** Eigene Punkte je Dart dieser Aufnahme (für Vergleiche „nach gleich vielen Darts“). */
  dartPoints: number[];
}

export interface CricketLegState {
  /** Marks je Spieler und Zielzahl (auch über die Trefferzahl hinaus gezählt). */
  marks: Record<number, Record<number, number>>;
  points: Record<number, number>;
  winner: number | null;
}

export type CricketTurn = CoreTurn<CricketTurnData>;
export type CricketLeg = CoreLeg<CricketLegState, CricketTurnData>;
export type CricketState = CoreState<CricketLegState, CricketTurnData> & {
  setup: CricketSetup;
  marks: Record<number, Record<number, number>>;
  points: Record<number, number>;
};

export function validateCricket(s: CricketSettings): string[] {
  const errors: string[] = [];
  const valid = s.targets.every((n) => (Number.isInteger(n) && n >= 1 && n <= 20) || n === BULL);
  if (!s.targets.length || !valid || new Set(s.targets).size !== s.targets.length) {
    errors.push('Mindestens eine Zielzahl wählen (1–20 oder Bull).');
  }
  if (!Number.isInteger(s.closeAt) || s.closeAt < 1 || s.closeAt > 9) errors.push('Treffer bis zu: 1 bis 9.');
  for (const [name, r] of [['Legs', s.legs], ['Sets', s.sets]] as const) {
    if (!r) continue;
    if (!Number.isInteger(r.count) || r.count < 1 || r.count > 99) errors.push(`${name}: Anzahl 1 bis 99.`);
    if (r.kind === 'bestOf' && r.count % 2 === 0) errors.push(`${name}: „best of“ nur mit ungerader Zahl.`);
  }
  return errors;
}

/** Marks eines Darts auf eine Zahl: Single 1, Double 2, Triple 3; Bull: 25 = 1, 50 = 2. */
export function marksOf(f: Field): number {
  return f.m;
}

export function isClosed(ls: CricketLegState, slot: number, n: number, closeAt: number): boolean {
  return (ls.marks[slot][n] ?? 0) >= closeAt;
}

function cricketRules(setup: CricketSetup): Rules<CricketLegState, CricketTurnData> {
  const { settings: s, order } = setup;
  const others = (slot: number) => order.filter((x) => x !== slot);

  /** Hat dieser Spieler gewonnen? Alles zu und Punkte passen zur Variante (SPEC 7.2, Regeln 7 und 8). */
  const hasWon = (ls: CricketLegState, slot: number) =>
    s.targets.every((n) => isClosed(ls, slot, n, s.closeAt)) &&
    others(slot).every((o) =>
      s.variant === 'standard' ? ls.points[slot] >= ls.points[o] : ls.points[slot] <= ls.points[o],
    );

  return {
    gameId: setup.gameId,
    order,
    format: { legs: s.legs, sets: s.sets },
    newLeg: () => ({
      marks: Object.fromEntries(order.map((p) => [p, Object.fromEntries(s.targets.map((n) => [n, 0]))])),
      points: Object.fromEntries(order.map((p) => [p, 0])),
      winner: null,
    }),
    newTurn: () => ({ marks: 0, points: 0, given: {}, dartPoints: [] }),
    applyDart: (ls, turn, d) => {
      const f = d.field!;
      const slot = turn.slot;
      if (f.m === 0 || !s.targets.includes(f.n)) {
        turn.dartPoints.push(0);
        return { scored: 0, endsTurn: false };
      }
      const pointsBefore = turn.points;
      const m = marksOf(f);
      const have = ls.marks[slot][f.n];
      const closing = Math.min(m, Math.max(0, s.closeAt - have));
      const extra = m - closing;
      ls.marks[slot][f.n] = have + m;

      let counted = closing;
      if (extra > 0) {
        const value = f.n * extra; // Bull = 25 je Mark
        const open = others(slot).filter((o) => !isClosed(ls, o, f.n, s.closeAt));
        if (open.length) {
          counted += extra;
          if (s.variant === 'standard') {
            ls.points[slot] += value;
            turn.points += value;
          } else {
            for (const o of open) {
              ls.points[o] += value;
              turn.given[o] = (turn.given[o] ?? 0) + value;
            }
          }
        }
      }
      turn.marks += counted;
      turn.dartPoints.push(turn.points - pointsBefore);

      // Gewonnen? Zuerst der Werfer, dann die anderen (bei Cut-Throat können Punkte an Gegner
      // einen Spieler, der schon alles zu hat, auf den letzten Platz der Punkte bringen).
      const candidates = [slot, ...others(slot)];
      const w = candidates.find((p) => hasWon(ls, p));
      if (w !== undefined) {
        ls.winner = w;
        return { scored: counted, endsTurn: true };
      }
      return { scored: counted, endsTurn: false };
    },
    winners: (ls) => (ls.winner === null ? null : [ls.winner]),
  };
}

export function computeCricket(setup: CricketSetup, events: readonly GameEvent[]): CricketState {
  const core = computeCore(cricketRules(setup), events);
  const current = core.legs[core.legs.length - 1].state;
  return { ...core, setup, marks: current.marks, points: current.points };
}

export function throwCricketDart(state: CricketState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmCricketTurn(state: CricketState): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoCricket(state: CricketState): NewEvent[] {
  return undoCore(state);
}

export function planCricketEdit(
  state: CricketState,
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
    (evs) => computeCricket(state.setup, evs),
    // Ausgang: Bei Cricket endet eine Aufnahme vorzeitig nur, wenn das Leg entschieden ist.
    (t) => String(t.ended),
  );
}
