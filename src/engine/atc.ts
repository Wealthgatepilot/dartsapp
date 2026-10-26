// Around the Clock nach SPEC 7.5: Ziele der Reihe nach treffen, wer das letzte Ziel trifft, gewinnt sofort.

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
import { BULL, isValidField, type Field } from './types';

export interface AtcSettings {
  /** Bis 20 oder mit Bull am Ende. */
  withBull: boolean;
  /** Welcher Ring zählt. */
  ring: 'any' | 'double' | 'triple';
  /** Double springt 2 Ziele weiter, Triple 3 (nur bei Ring „beliebig“). */
  jumps: boolean;
}

export const DEFAULT_ATC: AtcSettings = { withBull: false, ring: 'any', jumps: false };

export interface AtcSetup {
  gameId: string;
  settings: AtcSettings;
  order: number[];
}

/** Kurzform der Einstellungen für Titel und Statistik, z. B. „ · Doubles · mit Bull“ (leer = Standard). */
export function atcVariantLabel(s: AtcSettings): string {
  const parts = [
    s.ring === 'double' ? 'Doubles' : s.ring === 'triple' ? 'Triples' : '',
    s.ring === 'any' && s.jumps ? 'mit Sprüngen' : '',
    s.withBull ? 'mit Bull' : '',
  ].filter(Boolean);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

export function atcTargets(s: AtcSettings): number[] {
  const nums = Array.from({ length: 20 }, (_, i) => i + 1);
  return s.withBull ? [...nums, BULL] : nums;
}

/**
 * Zählt dieser Dart für das Ziel, und wie viele Ziele geht es weiter (0 = kein Treffer)?
 * Beim Bull gibt es kein Triple: Bei „nur Triples“ zählt dort das Bullseye.
 */
export function atcAdvance(s: AtcSettings, target: number, f: Field): number {
  if (f.m === 0 || f.n !== target) return 0;
  if (s.ring === 'double' && f.m !== 2) return 0;
  if (s.ring === 'triple' && f.m !== (target === BULL ? 2 : 3)) return 0;
  return s.ring === 'any' && s.jumps && target !== BULL ? f.m : 1;
}

export interface AtcTurnData {
  /** Position in der Zielfolge zu Beginn der Aufnahme (0 = erstes Ziel). */
  startIndex: number;
  /** Treffer in dieser Aufnahme. */
  hits: number;
}

export interface AtcLegState {
  /** Position in der Zielfolge je Spieler; = Anzahl Ziele heißt fertig. */
  index: Record<number, number>;
  hits: Record<number, number>;
  winner: number | null;
}

export type AtcTurn = CoreTurn<AtcTurnData>;
export type AtcState = CoreState<AtcLegState, AtcTurnData> & {
  setup: AtcSetup;
  targets: number[];
  /** Aktuelles Ziel je Spieler, null = fertig. */
  targetOf: (slot: number) => number | null;
};

function atcRules(setup: AtcSetup): Rules<AtcLegState, AtcTurnData> {
  const { settings: s, order } = setup;
  const targets = atcTargets(s);
  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({
      index: Object.fromEntries(order.map((p) => [p, 0])),
      hits: Object.fromEntries(order.map((p) => [p, 0])),
      winner: null,
    }),
    newTurn: (ls, slot) => ({ startIndex: ls.index[slot], hits: 0 }),
    applyDart: (ls, turn, d) => {
      const i = ls.index[turn.slot];
      const step = i < targets.length ? atcAdvance(s, targets[i], d.field!) : 0;
      if (!step) return { scored: 0, endsTurn: false };
      ls.index[turn.slot] = Math.min(targets.length, i + step);
      ls.hits[turn.slot]++;
      turn.hits++;
      if (ls.index[turn.slot] >= targets.length) {
        ls.winner = turn.slot;
        return { scored: 1, endsTurn: true };
      }
      return { scored: 1, endsTurn: false };
    },
    winners: (ls) => (ls.winner !== null ? [ls.winner] : null),
  };
}

export function computeAtc(setup: AtcSetup, events: readonly GameEvent[]): AtcState {
  const core = computeCore(atcRules(setup), events);
  const targets = atcTargets(setup.settings);
  const index = core.legs[0].state.index;
  return {
    ...core,
    setup,
    targets,
    targetOf: (slot) => (index[slot] < targets.length ? targets[index[slot]] : null),
  };
}

export function throwAtcDart(state: AtcState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmAtcTurn(state: AtcState): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoAtc(state: AtcState): NewEvent[] {
  return undoCore(state);
}

export function planAtcEdit(
  state: AtcState,
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
    (evs) => computeAtc(state.setup, evs),
    // Nur ein Sieg beendet die Aufnahme vorzeitig: Ändert sich das, fragt die App nach.
    (t) => String(t.ended),
  );
}
