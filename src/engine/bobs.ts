// Bob's 27 nach SPEC 7.8: Start mit 27 Punkten, Ziele D1 … D20 und Bullseye, je Ziel eine Aufnahme.
// Jeder Treffer bringt den Wert des Doubles; eine Aufnahme ganz ohne Treffer kostet ihn einmal.

import {
  computeCore,
  confirmTurnCore,
  throwDartCore,
  undoCore,
  type CoreState,
  type DartInput,
  type Rules,
  type Turn as CoreTurn,
} from './core';
import type { DartPayload, GameEvent, NewEvent } from './events';
import { BULL, isValidField, points, type Field } from './types';

export interface BobsSettings {
  /** Wer auf 0 oder weniger fällt, scheidet aus. */
  dieAtZero: boolean;
}

export const DEFAULT_BOBS: BobsSettings = { dieAtZero: true };
export const BOBS_START = 27;

export interface BobsSetup {
  gameId: string;
  settings: BobsSettings;
  order: number[];
}

/** Ziele D1 … D20 und Bullseye, je eine Aufnahme. */
export const BOBS_TARGETS: Field[] = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL].map((n) => ({ n, m: 2 as const }));

export interface BobsTurnData {
  target: Field;
  hits: number;
  /** Punkteänderung dieser Aufnahme (erst nach dem dritten Dart vollständig). */
  change: number;
}

export interface BobsLegState {
  score: Record<number, number>;
  /** Gespielte Aufnahmen je Spieler. */
  played: Record<number, number>;
  /** Ausgeschieden (bei „Bei 0 oder weniger ausscheiden“). */
  out: number[];
}

export type BobsTurn = CoreTurn<BobsTurnData>;
export type BobsState = CoreState<BobsLegState, BobsTurnData> & {
  setup: BobsSetup;
  score: Record<number, number>;
  /** Ziel des Spielers, der dran ist (bzw. dessen Aufnahme auf Weiter wartet). */
  target: Field | null;
};

const miss = (): DartInput => ({ field: null, hit: false });

function bobsRules(setup: BobsSetup): Rules<BobsLegState, BobsTurnData> {
  const { settings: s, order } = setup;
  const isDone = (ls: BobsLegState, slot: number) =>
    ls.played[slot] >= BOBS_TARGETS.length || ls.out.includes(slot);
  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({
      score: Object.fromEntries(order.map((p) => [p, BOBS_START])),
      played: Object.fromEntries(order.map((p) => [p, 0])),
      out: [],
    }),
    newTurn: (_ls, _slot, round) => ({ target: BOBS_TARGETS[round - 1], hits: 0, change: 0 }),
    isDone,
    acceptsDart: (d) => typeof d.hit === 'boolean' && (d.field === null || isValidField(d.field)),
    applyDart: (ls, turn, d, dartIndex) => {
      const value = points(turn.target);
      let scored = 0;
      if (d.hit) {
        turn.hits++;
        turn.change += value;
        ls.score[turn.slot] += value;
        scored = value;
      }
      if (dartIndex === 3) {
        if (turn.hits === 0) {
          turn.change -= value;
          ls.score[turn.slot] -= value;
        }
        ls.played[turn.slot]++;
        if (s.dieAtZero && ls.score[turn.slot] <= 0) ls.out.push(turn.slot);
      }
      return { scored, endsTurn: false };
    },
    winners: (ls, at) => {
      if (!at.afterTurn || !order.every((slot) => isDone(ls, slot))) return null;
      const best = Math.max(...order.map((p) => ls.score[p]));
      return order.filter((p) => ls.score[p] === best);
    },
    autoMiss: miss,
  };
}

export function computeBobs(setup: BobsSetup, events: readonly GameEvent[]): BobsState {
  const core = computeCore(bobsRules(setup), events);
  const turnIndex = core.next?.turnIndex ?? core.currentTurn?.turnIndex;
  return {
    ...core,
    setup,
    score: core.legs[0].state.score,
    target: turnIndex && !core.finished ? BOBS_TARGETS[turnIndex - 1] : null,
  };
}

/** Treffer oder Falsch für das Ziel der laufenden Aufnahme. */
export function throwBobsDart(state: BobsState, hit: boolean, input: DartPayload['input'] = 'hitmiss'): NewEvent | null {
  const pos = state.next;
  if (!pos) return null;
  const target = BOBS_TARGETS[pos.turnIndex - 1];
  const ev = throwDartCore(state, { acceptsDart: () => true }, { field: hit ? target : null, hit }, input);
  if (ev?.type === 'dart.thrown') ev.payload.target = target;
  return ev;
}

export function confirmBobsTurn(state: BobsState): NewEvent[] {
  return confirmTurnCore(state, { autoMiss: miss });
}

export function undoBobs(state: BobsState): NewEvent[] {
  return undoCore(state);
}
