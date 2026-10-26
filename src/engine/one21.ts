// 121 nach SPEC 7.7: Checkout-Training. Jeder Versuch hat eine feste Zahl Darts, um das Ziel zu checken;
// geschafft → nächstes Ziel um 1 höher, sonst gleiches Ziel bzw. 1 niedriger. Bust und Out wie bei X01.

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

export interface One21Settings {
  /** Startziel 61–170. */
  startTarget: number;
  /** Darts pro Versuch: 3, 6, 9 oder 12 (= 1 bis 4 Aufnahmen). */
  dartsPerAttempt: 3 | 6 | 9 | 12;
  outMode: 'double' | 'master';
  /** Nach einem Fehlschlag: gleiches Ziel oder 1 niedriger (nie unter das Startziel). */
  afterFail: 'same' | 'down';
  /** Versuche je Spieler 1–50. */
  attempts: number;
}

export const DEFAULT_ONE21: One21Settings = { startTarget: 121, dartsPerAttempt: 9, outMode: 'double', afterFail: 'same', attempts: 10 };
export const ONE21_MAX = 170;

export interface One21Setup {
  gameId: string;
  settings: One21Settings;
  order: number[];
}

export function validateOne21(s: One21Settings): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(s.startTarget) || s.startTarget < 61 || s.startTarget > ONE21_MAX) errors.push('Startziel 61 bis 170.');
  if (!Number.isInteger(s.attempts) || s.attempts < 1 || s.attempts > 50) errors.push('Versuche 1 bis 50.');
  return errors;
}

export interface One21Player {
  target: number;
  rest: number;
  /** Abgeschlossene Aufnahmen im laufenden Versuch. */
  turnsUsed: number;
  attemptsDone: number;
  successes: number;
  /** Höchstes gechecktes Ziel, null = noch keins. */
  highest: number | null;
}

export interface One21TurnData {
  target: number;
  /** Nummer des Versuchs (ab 1) und Aufnahme darin (ab 1). */
  attempt: number;
  turnOfAttempt: number;
  startRest: number;
  endRest: number;
  bust: boolean;
  checkout: boolean;
  /** Der Versuch endet mit dieser Aufnahme ohne Checkout. */
  failed: boolean;
}

export interface One21LegState {
  players: Record<number, One21Player>;
}

export type One21Turn = CoreTurn<One21TurnData>;
export type One21State = CoreState<One21LegState, One21TurnData> & {
  setup: One21Setup;
  players: Record<number, One21Player>;
};

const qualifiesOut = (out: One21Settings['outMode'], f: Field) => (out === 'double' ? f.m === 2 : f.m >= 2);

function one21Rules(setup: One21Setup): Rules<One21LegState, One21TurnData> {
  const { settings: s, order } = setup;
  const turnsPerAttempt = s.dartsPerAttempt / 3;
  const isDone = (ls: One21LegState, slot: number) => ls.players[slot].attemptsDone >= s.attempts;

  /** Neuer Versuch mit dem nächsten Ziel. */
  const nextAttempt = (p: One21Player, target: number) => {
    p.attemptsDone++;
    p.turnsUsed = 0;
    p.target = target;
    p.rest = target;
  };

  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({
      players: Object.fromEntries(
        order.map((slot) => [
          slot,
          { target: s.startTarget, rest: s.startTarget, turnsUsed: 0, attemptsDone: 0, successes: 0, highest: null },
        ]),
      ),
    }),
    newTurn: (ls, slot) => {
      const p = ls.players[slot];
      return {
        target: p.target,
        attempt: p.attemptsDone + 1,
        turnOfAttempt: p.turnsUsed + 1,
        startRest: p.rest,
        endRest: p.rest,
        bust: false,
        checkout: false,
        failed: false,
      };
    },
    isDone,
    applyDart: (ls, turn, d, dartIndex) => {
      const p = ls.players[turn.slot];
      const f = d.field!;
      const scored = points(f);
      const after = turn.endRest - scored;
      const bust = after < 0 || after === 1 || (after === 0 && !qualifiesOut(s.outMode, f));
      let ends = false;
      if (bust) {
        // Bust: Rest zurück auf den Stand vor der Aufnahme, die Aufnahme ist vorbei (SPEC 7.7)
        turn.bust = true;
        turn.endRest = turn.startRest;
        ends = true;
      } else if (after === 0) {
        turn.endRest = 0;
        turn.checkout = true;
        p.successes++;
        p.highest = Math.max(p.highest ?? 0, turn.target);
        nextAttempt(p, Math.min(ONE21_MAX, turn.target + 1));
        return { scored, endsTurn: true };
      } else {
        turn.endRest = after;
      }
      p.rest = turn.endRest;
      if (ends || dartIndex === 3) {
        p.turnsUsed++;
        if (p.turnsUsed >= turnsPerAttempt) {
          turn.failed = true;
          nextAttempt(p, s.afterFail === 'down' ? Math.max(s.startTarget, turn.target - 1) : turn.target);
        }
      }
      return { scored, endsTurn: ends };
    },
    winners: (ls, at) => {
      if (!at.afterTurn || !order.every((slot) => isDone(ls, slot))) return null;
      // Rangfolge: höchstes gechecktes Ziel, dann Anzahl Erfolge; Gleichstand = geteilter Sieg
      const score = (slot: number) => (ls.players[slot].highest ?? 0) * 100 + ls.players[slot].successes;
      const best = Math.max(...order.map(score));
      return order.filter((slot) => score(slot) === best);
    },
  };
}

export function computeOne21(setup: One21Setup, events: readonly GameEvent[]): One21State {
  const core = computeCore(one21Rules(setup), events);
  return { ...core, setup, players: core.legs[0].state.players };
}

export function throwOne21Dart(state: One21State, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmOne21Turn(state: One21State): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoOne21(state: One21State): NewEvent[] {
  return undoCore(state);
}

export function planOne21Edit(
  state: One21State,
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
    (evs) => computeOne21(state.setup, evs),
    (t) => `${t.bust}|${t.checkout}`,
  );
}

/** Darts, die im laufenden Versuch des Spielers noch übrig sind (für den Checkout-Vorschlag). */
export function dartsLeftInAttempt(state: One21State, slot: number, dartIndex: number): number {
  const p = state.players[slot];
  return (state.setup.settings.dartsPerAttempt / 3 - p.turnsUsed - 1) * 3 + (4 - dartIndex);
}
