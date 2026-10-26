// Killer nach SPEC 7.6: Jeder hat eine eigene Zahl. Wer sie oft genug trifft, wird Killer und nimmt
// den Gegnern mit Treffern auf deren Zahlen Leben. Wer keine Leben mehr hat, scheidet aus.

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
import { isValidField, type Field } from './types';

export interface KillerSettings {
  /** Wie die Zahlen verteilt wurden (die Zahlen selbst stehen in `numbers`). */
  assignment: 'random' | 'choose';
  /** Zahl 1–20 je Spieler (Schlüssel: Slot), jede nur einmal. Wird beim Start festgelegt. */
  numbers: Record<number, number>;
  /** Leben 1–9. */
  lives: number;
  /** Treffer auf die eigene Zahl bis zum Killer 1–3. */
  hitsToKiller: number;
  /** Was als Treffer zählt: nur Doubles oder das ganze Segment. */
  zone: 'double' | 'segment';
  /** Eigentreffer als Killer: kostet ein Leben oder zählt nicht. */
  selfHit: 'lose' | 'nothing';
}

export const DEFAULT_KILLER: KillerSettings = {
  assignment: 'random',
  numbers: {},
  lives: 3,
  hitsToKiller: 1,
  zone: 'double',
  selfHit: 'lose',
};

export interface KillerSetup {
  gameId: string;
  settings: KillerSettings;
  order: number[];
}

export function validateKiller(s: KillerSettings, players: number): string[] {
  const errors: string[] = [];
  if (players < 2 || players > 20) errors.push('Killer braucht 2 bis 20 Spieler.');
  if (!Number.isInteger(s.lives) || s.lives < 1 || s.lives > 9) errors.push('Leben 1 bis 9.');
  if (!Number.isInteger(s.hitsToKiller) || s.hitsToKiller < 1 || s.hitsToKiller > 3) errors.push('Treffer bis Killer 1 bis 3.');
  return errors;
}

/** Prüft selbst gewählte Zahlen: jede 1–20 und nur einmal. */
export function validateKillerNumbers(numbers: number[]): string[] {
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 20)) return ['Jeder Spieler braucht eine Zahl von 1 bis 20.'];
  return new Set(numbers).size === numbers.length ? [] : ['Jede Zahl darf nur einmal vergeben werden.'];
}

/** Zufällige, verschiedene Zahlen 1–20 für `count` Spieler. `random` liefert Werte in [0, 1). */
export function randomKillerNumbers(count: number, random: () => number): number[] {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Wirkung eines Darts, für die Anzeige. */
export type KillerEffect =
  | { kind: 'progress'; slot: number }
  | { kind: 'killer'; slot: number }
  | { kind: 'life'; slot: number }
  | { kind: 'out'; slot: number };

export interface KillerTurnData {
  effects: KillerEffect[];
}

export interface KillerLegState {
  lives: Record<number, number>;
  /** Treffer auf die eigene Zahl (bis zum Killer). */
  progress: Record<number, number>;
  killer: Record<number, boolean>;
  out: number[];
  winner: number | null;
}

export type KillerTurn = CoreTurn<KillerTurnData>;
export type KillerState = CoreState<KillerLegState, KillerTurnData> & {
  setup: KillerSetup;
  /** Zahlen, die der Werfer gerade sinnvoll treffen kann (für die Farben auf dem Board). */
  targetsFor: (slot: number) => number[];
};

/** Zählt der Dart als Treffer in der Zone? */
const inZone = (s: KillerSettings, f: Field) => f.m > 0 && (s.zone === 'segment' || f.m === 2);

function killerRules(setup: KillerSetup): Rules<KillerLegState, KillerTurnData> {
  const { settings: s, order } = setup;
  const owner = (n: number) => order.find((slot) => s.numbers[slot] === n);
  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({
      lives: Object.fromEntries(order.map((p) => [p, s.lives])),
      progress: Object.fromEntries(order.map((p) => [p, 0])),
      killer: Object.fromEntries(order.map((p) => [p, false])),
      out: [],
      winner: null,
    }),
    newTurn: () => ({ effects: [] }),
    isDone: (ls, slot) => ls.out.includes(slot),
    applyDart: (ls, turn, d) => {
      const f = d.field!;
      const me = turn.slot;
      const hit = f.n <= 20 ? owner(f.n) : undefined;
      if (hit === undefined || !inZone(s, f) || ls.out.includes(hit)) return { scored: 0, endsTurn: false };

      const loseLife = (slot: number) => {
        ls.lives[slot]--;
        turn.effects.push({ kind: 'life', slot });
        if (ls.lives[slot] <= 0) {
          ls.out.push(slot);
          turn.effects.push({ kind: 'out', slot });
        }
      };

      if (hit === me) {
        if (!ls.killer[me]) {
          ls.progress[me]++;
          turn.effects.push({ kind: 'progress', slot: me });
          if (ls.progress[me] >= s.hitsToKiller) {
            ls.killer[me] = true;
            turn.effects.push({ kind: 'killer', slot: me });
          }
          return { scored: 1, endsTurn: false };
        }
        if (s.selfHit === 'nothing') return { scored: 0, endsTurn: false };
        loseLife(me);
      } else {
        // Treffer vor dem Killer-Status auf fremde Zahlen zählen nichts (SPEC 7.6, Regel 5)
        if (!ls.killer[me]) return { scored: 0, endsTurn: false };
        loseLife(hit);
      }
      const alive = order.filter((p) => !ls.out.includes(p));
      if (alive.length === 1) ls.winner = alive[0];
      // Wer sich selbst rauswirft, darf nicht weiterwerfen
      return { scored: 1, endsTurn: ls.winner !== null || ls.out.includes(me) };
    },
    winners: (ls) => (ls.winner !== null ? [ls.winner] : null),
  };
}

export function computeKiller(setup: KillerSetup, events: readonly GameEvent[]): KillerState {
  const core = computeCore(killerRules(setup), events);
  const ls = core.legs[0].state;
  const { numbers } = setup.settings;
  return {
    ...core,
    setup,
    targetsFor: (slot) =>
      ls.killer[slot] ? setup.order.filter((p) => !ls.out.includes(p)).map((p) => numbers[p]) : [numbers[slot]],
  };
}

export function throwKillerDart(state: KillerState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmKillerTurn(state: KillerState): NewEvent[] {
  return confirmTurnCore(state, {});
}

export function undoKiller(state: KillerState): NewEvent[] {
  return undoCore(state);
}

export function planKillerEdit(
  state: KillerState,
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
    (evs) => computeKiller(state.setup, evs),
    // Ein Ausscheiden oder der Sieg ändert den Spielverlauf: dann fragt die App nach.
    (t) => t.effects.filter((e) => e.kind === 'out').map((e) => e.slot).join(','),
  );
}
