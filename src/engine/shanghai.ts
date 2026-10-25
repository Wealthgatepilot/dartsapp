// Shanghai nach SPEC 7.3: pro Runde ein Ziel, Punkte nur auf das Ziel, Shanghai = Single, Double und Triple.

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

export interface ShanghaiSettings {
  /** Startzahl 1–20. */
  startNumber: number;
  /** Rundenzahl 1 bis (22 − Startzahl). */
  rounds: number;
  /** Ein Shanghai gewinnt sofort (sonst wird es nur vermerkt). */
  endOnShanghai: boolean;
}

export const DEFAULT_SHANGHAI: ShanghaiSettings = { startNumber: 1, rounds: 20, endOnShanghai: true };

export interface ShanghaiSetup {
  gameId: string;
  settings: ShanghaiSettings;
  order: number[];
}

/** Zielfolge: 1, 2, …, 20, Bull. */
const SEQUENCE = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL];

export function maxRounds(startNumber: number): number {
  return 22 - startNumber;
}

/** Ziel der Runde (ab 1). */
export function targetOfRound(s: ShanghaiSettings, round: number): number {
  return SEQUENCE[s.startNumber - 1 + round - 1];
}

export function validateShanghai(s: ShanghaiSettings): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(s.startNumber) || s.startNumber < 1 || s.startNumber > 20) errors.push('Startzahl 1 bis 20.');
  else if (!Number.isInteger(s.rounds) || s.rounds < 1 || s.rounds > maxRounds(s.startNumber)) {
    errors.push(`Rundenzahl 1 bis ${maxRounds(s.startNumber)}.`);
  }
  return errors;
}

export interface ShanghaiTurnData {
  target: number;
  points: number;
  /** Marks auf das Ziel: Single 1, Double 2, Triple 3 (SPEC 11.4). */
  marks: number;
  shanghai: boolean;
  /** Getroffene Ringe des Ziels in dieser Aufnahme (1, 2, 3). */
  rings: number[];
}

export interface ShanghaiLegState {
  points: Record<number, number>;
  /** Wer ein Shanghai geworfen hat (bei „beendet das Spiel“ der Sieger). */
  shanghaiBy: number[];
  winner: number | null;
}

export type ShanghaiTurn = CoreTurn<ShanghaiTurnData>;
export type ShanghaiState = CoreState<ShanghaiLegState, ShanghaiTurnData> & {
  setup: ShanghaiSetup;
  points: Record<number, number>;
};

function shanghaiRules(setup: ShanghaiSetup): Rules<ShanghaiLegState, ShanghaiTurnData> {
  const { settings: s, order } = setup;
  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({ points: Object.fromEntries(order.map((p) => [p, 0])), shanghaiBy: [], winner: null }),
    newTurn: (_ls, _slot, round) => ({ target: targetOfRound(s, round), points: 0, marks: 0, shanghai: false, rings: [] }),
    applyDart: (ls, turn, d) => {
      const f = d.field!;
      if (f.m === 0 || f.n !== turn.target) return { scored: 0, endsTurn: false };
      const pts = points(f);
      ls.points[turn.slot] += pts;
      turn.points += pts;
      turn.marks += f.m;
      if (!turn.rings.includes(f.m)) turn.rings.push(f.m);
      if (!turn.shanghai && [1, 2, 3].every((m) => turn.rings.includes(m))) {
        turn.shanghai = true;
        ls.shanghaiBy.push(turn.slot);
        if (s.endOnShanghai) {
          ls.winner = turn.slot;
          return { scored: pts, endsTurn: true };
        }
      }
      return { scored: pts, endsTurn: false };
    },
    winners: (ls, at) => {
      if (ls.winner !== null) return [ls.winner];
      // Nach der letzten Aufnahme der letzten Runde: meiste Punkte, Gleichstand = geteilter Sieg
      if (at.afterTurn && at.lastInRound && at.round >= s.rounds) {
        const best = Math.max(...order.map((p) => ls.points[p]));
        return order.filter((p) => ls.points[p] === best);
      }
      return null;
    },
  };
}

export function computeShanghai(setup: ShanghaiSetup, events: readonly GameEvent[]): ShanghaiState {
  const core = computeCore(shanghaiRules(setup), events);
  return { ...core, setup, points: core.legs[0].state.points };
}

export function throwShanghaiDart(state: ShanghaiState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmShanghaiTurn(state: ShanghaiState): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoShanghai(state: ShanghaiState): NewEvent[] {
  return undoCore(state);
}

export function planShanghaiEdit(
  state: ShanghaiState,
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
    (evs) => computeShanghai(state.setup, evs),
    (t) => String(t.shanghai),
  );
}
