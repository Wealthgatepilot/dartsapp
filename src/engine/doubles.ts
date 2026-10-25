// Doppelfeld-Training nach SPEC 7.4: D1–D20 und Bullseye in zufälliger Folge, Eingabe Treffer/Falsch.

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
import type { GameEvent, NewEvent } from './events';
import { BULL, fieldLabel, isValidField, type Field } from './types';

export interface DoublesSettings {
  /** Alle dieselbe Zufallsfolge oder jeder seine eigene. */
  sequence: 'own' | 'shared';
  /** Bis zum Treffer, oder eine feste Zahl Darts pro Feld (1–30). */
  mode: { kind: 'untilHit' } | { kind: 'fixed'; darts: number };
}

export const DEFAULT_DOUBLES: DoublesSettings = { sequence: 'own', mode: { kind: 'untilHit' } };

export interface DoublesSetup {
  gameId: string;
  settings: DoublesSettings;
  order: number[];
  /** Zufallswert aus game.created; daraus entsteht die Zielfolge. */
  seed: number;
}

/** Die 21 Ziele: D1–D20 und Bullseye (beim Bull zählt nur das Bullseye). */
export const DOUBLE_TARGETS: Field[] = [...Array.from({ length: 20 }, (_, i) => ({ n: i + 1, m: 2 as const })), { n: BULL, m: 2 }];

export function validateDoubles(s: DoublesSettings): string[] {
  if (s.mode.kind === 'fixed' && (!Number.isInteger(s.mode.darts) || s.mode.darts < 1 || s.mode.darts > 30)) {
    return ['Darts pro Feld: 1 bis 30.'];
  }
  return [];
}

/** Kleiner, fester Zufallsgenerator (mulberry32): gleicher Seed → gleiche Folge, auf jedem Gerät. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zielfolge mischen nach Fisher-Yates (SPEC 7.4, Regel 2). */
export function shuffledTargets(seed: number): Field[] {
  const rnd = random(seed);
  const list = [...DOUBLE_TARGETS];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Zielfolge eines Spielers: gemeinsam aus dem Spiel-Seed, sonst je Platz ein abgeleiteter Seed. */
export function sequenceFor(setup: DoublesSetup, slot: number): Field[] {
  return shuffledTargets(setup.settings.sequence === 'shared' ? setup.seed : setup.seed + (slot + 1) * 7919);
}

export interface FieldStats {
  darts: number;
  hits: number;
}

export interface DoublesPlayer {
  sequence: Field[];
  /** Position in der Zielfolge (0–21; 21 = fertig). */
  index: number;
  /** Darts auf das aktuelle Ziel (für „feste Zahl“). */
  dartsOnTarget: number;
  /** Je Ziel, Schlüssel = Kurzschreibweise (D16, DB). */
  stats: Record<string, FieldStats>;
  darts: number;
  hits: number;
  /** Abgeschlossene Ziele mit den dafür nötigen Darts (Verlauf). */
  history: { target: Field; darts: number; hit: boolean }[];
}

export interface DoublesLegState {
  players: Record<number, DoublesPlayer>;
}

export interface DoublesTurnData {
  hits: number;
}

export type DoublesTurn = CoreTurn<DoublesTurnData>;
export type DoublesState = CoreState<DoublesLegState, DoublesTurnData> & {
  setup: DoublesSetup;
  players: Record<number, DoublesPlayer>;
};

export function currentTarget(p: DoublesPlayer): Field | null {
  return p.index < p.sequence.length ? p.sequence[p.index] : null;
}

function doublesRules(setup: DoublesSetup): Rules<DoublesLegState, DoublesTurnData> {
  const { settings: s, order } = setup;
  const fixed = s.mode.kind === 'fixed' ? s.mode.darts : null;
  const done = (p: DoublesPlayer) => p.index >= p.sequence.length;

  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({
      players: Object.fromEntries(
        order.map((slot) => [
          slot,
          { sequence: sequenceFor(setup, slot), index: 0, dartsOnTarget: 0, stats: {}, darts: 0, hits: 0, history: [] },
        ]),
      ),
    }),
    newTurn: () => ({ hits: 0 }),
    isDone: (ls, slot) => done(ls.players[slot]),
    acceptsDart: (d) => typeof d.hit === 'boolean' && (d.field === null || isValidField(d.field)),
    applyDart: (ls, turn, d) => {
      const p = ls.players[turn.slot];
      const target = currentTarget(p)!;
      const key = fieldLabel(target);
      const st = (p.stats[key] ??= { darts: 0, hits: 0 });
      st.darts++;
      p.darts++;
      p.dartsOnTarget++;
      if (d.hit) {
        st.hits++;
        p.hits++;
        turn.hits++;
      }
      // Ziel wechseln: bis zum Treffer → beim Treffer; feste Zahl → nach n Darts
      if (fixed === null ? d.hit : p.dartsOnTarget >= fixed) {
        p.history.push({ target, darts: p.dartsOnTarget, hit: st.hits > 0 });
        p.index++;
        p.dartsOnTarget = 0;
      }
      return { scored: d.hit ? 1 : 0, endsTurn: done(p) };
    },
    winners: (ls, at) => {
      if (!at.afterTurn || !order.every((slot) => done(ls.players[slot]))) return null;
      // Bis zum Treffer: wenigste Darts. Feste Zahl: meiste Treffer. Gleichstand = geteilter Platz.
      const score = (slot: number) => (fixed === null ? -ls.players[slot].darts : ls.players[slot].hits);
      const best = Math.max(...order.map(score));
      return order.filter((slot) => score(slot) === best);
    },
    autoMiss: () => ({ field: null, hit: false }),
  };
}

export function computeDoubles(setup: DoublesSetup, events: readonly GameEvent[]): DoublesState {
  const core = computeCore(doublesRules(setup), events);
  return { ...core, setup, players: core.legs[0].state.players };
}

/** Treffer oder Falsch für das aktuelle Ziel des Spielers, der dran ist. */
export function throwDoublesDart(state: DoublesState, hit: boolean): NewEvent | null {
  const slot = state.next?.slot;
  if (slot === undefined) return null;
  const target = currentTarget(state.players[slot]);
  if (!target) return null;
  const d: DartInput = { field: hit ? target : null, hit };
  const ev = throwDartCore(state, { acceptsDart: () => true }, d, 'hitmiss');
  if (ev?.type === 'dart.thrown') ev.payload.target = target;
  return ev;
}

export function confirmDoublesTurn(state: DoublesState): NewEvent[] {
  return confirmTurnCore(state, { autoMiss: () => ({ field: null, hit: false }) });
}

export function undoDoubles(state: DoublesState): NewEvent[] {
  return undoCore(state);
}

/** Trefferquote in Prozent mit einer Nachkommastelle, „—“ ohne Würfe (SPEC 11.1). */
export function quote(hits: number, darts: number): string {
  return darts ? `${((hits / darts) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '—';
}
