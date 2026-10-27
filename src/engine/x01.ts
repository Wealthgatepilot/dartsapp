// X01 nach SPEC 7.1. Nur die Regeln stehen hier; Reihenfolge, Legs, Weiter, Rückgängig und
// Runde bearbeiten übernimmt das gemeinsame Gerüst (core.ts).

import {
  computeCore,
  confirmTurnCore,
  planEditCore,
  throwDartCore,
  undoCore,
  winsNeeded,
  type CoreState,
  type EditPlan,
  type Leg as CoreLeg,
  type Race,
  type Rules,
  type Turn as CoreTurn,
} from './core';
import type { DartPayload, GameEvent, NewEvent } from './events';
import { points, type Field } from './types';

export { winsNeeded, type Race, type EditPlan };
export type { DartView, Position } from './core';

export type InOut = 'single' | 'double' | 'master';

export interface X01Settings {
  startScore: number;
  inMode: InOut;
  outMode: InOut;
  legs: Race;
  /** null = nur Legs, keine Sets. */
  sets: Race | null;
}

export interface X01Setup {
  gameId: string;
  settings: X01Settings;
  /** Spielerplätze in Wurfreihenfolge des ersten Legs. */
  order: number[];
  /** Handicap: eigener Startwert je Platz (Phase 3). */
  startScores?: Record<number, number>;
  /** Um die Plätze weiterspielen erlaubt (neue Spiele, SPEC 5.0). */
  playOn?: boolean;
}

/** Zusätzliche Angaben einer X01-Aufnahme. */
export interface X01TurnData {
  startRemaining: number;
  endRemaining: number;
  startIn: boolean;
  endIn: boolean;
  bust: boolean;
  checkout: boolean;
}

/** Stand eines X01-Legs. */
export interface X01LegState {
  remaining: Record<number, number>;
  isIn: Record<number, boolean>;
  winner: number | null;
}

export type Turn = CoreTurn<X01TurnData>;
export type Leg = CoreLeg<X01LegState, X01TurnData>;

export type X01State = CoreState<X01LegState, X01TurnData> & {
  setup: X01Setup;
  /** Rest und In-Status je Platz im aktuellen (letzten) Leg. */
  remaining: Record<number, number>;
  isIn: Record<number, boolean>;
};

// ---------- Einstellungen ----------

export function validateSettings(s: X01Settings): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(s.startScore) || s.startScore < 2 || s.startScore > 9999) {
    errors.push('Startpunkte müssen zwischen 2 und 9999 liegen.');
  }
  for (const [name, r] of [['Legs', s.legs], ['Sets', s.sets]] as const) {
    if (!r) continue;
    if (!Number.isInteger(r.count) || r.count < 1 || r.count > 99) errors.push(`${name}: Anzahl 1 bis 99.`);
    if (r.kind === 'bestOf' && r.count % 2 === 0) errors.push(`${name}: „best of“ nur mit ungerader Zahl.`);
  }
  return errors;
}

/** Zählt dieser Dart als „rein“ (In-Regel)? */
export function qualifiesIn(mode: InOut, f: Field): boolean {
  if (f.m === 0) return false;
  if (mode === 'single') return true;
  if (mode === 'double') return f.m === 2;
  return f.m === 2 || f.m === 3;
}

/** Darf dieser Dart das Leg beenden (Out-Regel)? Bullseye gilt als Double. */
export function qualifiesOut(mode: InOut, f: Field): boolean {
  return qualifiesIn(mode, f);
}

/** Kleinster Rest, der mit dieser Out-Regel noch gecheckt werden kann. */
export function minFinishable(mode: InOut): number {
  return mode === 'single' ? 1 : 2;
}

// ---------- Regeln ----------

function x01Rules(setup: X01Setup): Rules<X01LegState, X01TurnData> {
  const { settings, order } = setup;
  return {
    gameId: setup.gameId,
    order,
    format: { legs: settings.legs, sets: settings.sets },
    newLeg: () => ({
      remaining: Object.fromEntries(order.map((s) => [s, setup.startScores?.[s] ?? settings.startScore])),
      isIn: Object.fromEntries(order.map((s) => [s, settings.inMode === 'single'])),
      winner: null,
    }),
    newTurn: (ls, slot) => ({
      startRemaining: ls.remaining[slot],
      endRemaining: ls.remaining[slot],
      startIn: ls.isIn[slot],
      endIn: ls.isIn[slot],
      bust: false,
      checkout: false,
    }),
    // Ein Dart nach SPEC 7.1. endRemaining/endIn laufen während der Aufnahme mit.
    applyDart: (ls, turn, d) => {
      const field = d.field!;
      if (!turn.endIn && qualifiesIn(settings.inMode, field)) turn.endIn = true;
      if (!turn.endIn) return { scored: 0, endsTurn: false };
      const scored = points(field);
      const after = turn.endRemaining - scored;
      const bust =
        after < 0 ||
        (after === 1 && settings.outMode !== 'single') ||
        (after === 0 && !qualifiesOut(settings.outMode, field));
      if (bust) {
        turn.bust = true;
        return { scored, endsTurn: true };
      }
      turn.endRemaining = after;
      if (after === 0) {
        turn.checkout = true;
        ls.winner ??= turn.slot; // beim Ausspielen der Plätze bleibt der Sieger
        return { scored, endsTurn: true };
      }
      return { scored, endsTurn: false };
    },
    // Bust: Rest und In-Status springen auf den Stand vor der Aufnahme zurück.
    afterDarts: (ls, turn) => {
      if (turn.bust) {
        turn.endRemaining = turn.startRemaining;
        turn.endIn = turn.startIn;
      }
      ls.remaining[turn.slot] = turn.endRemaining;
      ls.isIn[turn.slot] = turn.endIn;
    },
    winners: (ls) => (ls.winner === null ? null : [ls.winner]),
    ...(setup.playOn ? { finishedAt: (ls: X01LegState, slot: number) => ls.remaining[slot] === 0 } : {}),
  };
}

export function computeX01(setup: X01Setup, events: readonly GameEvent[]): X01State {
  const core = computeCore(x01Rules(setup), events);
  const current = core.legs[core.legs.length - 1].state;
  return { ...core, setup, remaining: current.remaining, isIn: current.isIn };
}

// ---------- Befehle ----------

/** Trägt einen Dart an der nächsten freien Position ein. null, wenn gerade kein Dart möglich ist. */
export function throwDart(state: X01State, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

/** „Weiter“: füllt fehlende Darts als daneben auf (SPEC 3.4) und bestätigt die Aufnahme. */
export function confirmTurn(state: X01State): NewEvent[] {
  return confirmTurnCore(state, {});
}

/** Rückgängig: letzter Dart, oder letztes „Weiter“ samt aufgefüllter Darts (SPEC 5.1). */
export function undo(state: X01State): NewEvent[] {
  return undoCore(state);
}

/**
 * Runde bearbeiten: ersetzt die Darts einer Aufnahme im laufenden Leg durch `fields`.
 * „Ausgang geändert“ heißt hier: Bust oder Checkout ändert sich (SPEC 5.2).
 */
export function planEdit(
  state: X01State,
  events: readonly GameEvent[],
  target: { leg: number; slot: number; turnIndex: number },
  fields: Field[],
): EditPlan {
  return planEditCore(
    state,
    {},
    events,
    target,
    fields.map((field) => ({ field })),
    (evs) => computeX01(state.setup, evs),
    (t) => `${t.bust}|${t.checkout}`,
  );
}
