// Zielwahl des Computers je Modus (SPEC 9): X01 und 121 nach Experten-Checkout, Cricket die offene Zahl
// mit dem höchsten Wert, alle anderen Modi auf das aktuelle Ziel.

import type { AtcState } from './atc';
import type { BobsState } from './bobs';
import { x01Aim } from './bot';
import type { CricketState } from './cricket';
import { currentTarget, type DoublesState } from './doubles';
import type { AnyGameState } from './games';
import type { HalveItState } from './halveit';
import type { KillerState } from './killer';
import type { One21Turn } from './one21';
import type { ShanghaiState } from './shanghai';
import { BULL, type Field } from './types';
import type { X01State } from './x01';

const T = (n: number): Field => (n === BULL ? { n: BULL, m: 2 } : { n, m: 3 });
const D = (n: number): Field => ({ n, m: 2 });
const S = (n: number): Field => (n === BULL ? { n: BULL, m: 1 } : { n, m: 1 });

/** Worauf der Computer, der gerade dran ist, mit dem nächsten Dart zielt. null = er ist nicht dran. */
export function botAim(g: AnyGameState): Field | null {
  const pos = g.state.next;
  if (!pos) return null;
  const slot = pos.slot;
  const dartsLeft = 4 - pos.dartIndex;
  switch (g.mode) {
    case 'x01':
      return aimX01(g.state, slot, dartsLeft);
    case 'cricket':
      return aimCricket(g.state, slot);
    case 'shanghai':
      return T(shanghaiTarget(g.state, pos.turnIndex));
    case 'countup':
      return T(20);
    case 'atc':
      return aimAtc(g.state, slot);
    case 'halveit': {
      const t = (g.state as HalveItState).target;
      return t === 'D' ? D(20) : t === 'T' || t === null ? T(20) : T(t);
    }
    case 'killer':
      return aimKiller(g.state, slot);
    case 'one21': {
      const turn = g.state.currentTurn as One21Turn | null;
      const rest = turn && turn.slot === slot ? turn.endRest : g.state.players[slot].rest;
      return x01Aim(rest, dartsLeft, g.state.setup.settings.outMode, null);
    }
    case 'doubles':
      return currentTarget((g.state as DoublesState).players[slot]);
    case 'bobs':
      return (g.state as BobsState).target;
  }
}

function aimX01(state: X01State, slot: number, dartsLeft: number): Field {
  const turn = state.currentTurn;
  const mine = turn && turn.slot === slot && !turn.confirmed;
  const rest = mine ? turn.endRemaining : state.remaining[slot];
  const isIn = mine ? turn.endIn : state.isIn[slot];
  return x01Aim(rest, dartsLeft, state.setup.settings.outMode, isIn ? null : state.setup.settings.inMode);
}

function shanghaiTarget(state: ShanghaiState, round: number): number {
  const s = state.setup.settings;
  const seq = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL];
  return seq[s.startNumber - 1 + round - 1];
}

function aimCricket(state: CricketState, slot: number): Field {
  const { targets, closeAt } = state.setup.settings;
  const value = (n: number) => n; // Bull = 25 ist der höchste Wert
  const byValue = [...targets].sort((a, b) => value(b) - value(a));
  const open = byValue.filter((n) => (state.marks[slot]?.[n] ?? 0) < closeAt);
  if (open.length) return T(open[0]);
  // Alles zu: auf eine Zahl, die ein Gegner noch offen hat (Standard: Punkte für mich, Cut-Throat: für ihn)
  const others = state.setup.order.filter((p) => p !== slot);
  const scoring = byValue.find((n) => others.some((p) => (state.marks[p]?.[n] ?? 0) < closeAt));
  return T(scoring ?? byValue[0]);
}

function aimAtc(state: AtcState, slot: number): Field {
  const target = state.targetOf(slot) ?? 20;
  // Am Bull zählt bei „beliebig“ auch das Bullseye: also auf die Mitte zielen
  if (target === BULL) return D(BULL);
  const ring = state.setup.settings.ring;
  return ring === 'double' ? D(target) : ring === 'triple' ? T(target) : S(target);
}

function aimKiller(state: KillerState, slot: number): Field {
  const s = state.setup.settings;
  const ls = state.legs[0].state;
  const zone = (n: number) => (s.zone === 'double' ? D(n) : S(n));
  if (!ls.killer[slot]) return zone(s.numbers[slot]);
  // Als Killer: den Gegner mit den wenigsten Leben angreifen
  const victims = state.setup.order.filter((p) => p !== slot && !ls.out.includes(p));
  victims.sort((a, b) => ls.lives[a] - ls.lives[b]);
  return zone(s.numbers[victims[0] ?? slot]);
}

/** Gleiches Feld? (für Treffer/Falsch-Modi: Der Computer trifft, wenn sein Dart genau im Ziel landet.) */
export function sameField(a: Field, b: Field): boolean {
  return a.n === b.n && a.m === b.m;
}
