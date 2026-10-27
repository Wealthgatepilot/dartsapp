// Doppelfeld-Training nach SPEC 7.4: D1–D20 und Bullseye in zufälliger Folge, Eingabe Treffer/Falsch.

import {
  collectEnd,
  computeCore,
  confirmTurnCore,
  decideEnd,
  throwDartCore,
  undoCore,
  type CoreState,
  type DartInput,
  type Rules,
  type Turn as CoreTurn,
} from './core';
import type { DartPayload, GameEvent, NewEvent } from './events';
import { BULL, fieldLabel, isValidField, type Field } from './types';

export interface DoublesSettings {
  /** Alle dieselbe Zufallsfolge oder jeder seine eigene. */
  sequence: 'own' | 'shared';
  /** Bis zum Treffer, oder eine feste Zahl Darts pro Feld (1–30). */
  mode: { kind: 'untilHit' } | { kind: 'fixed'; darts: number };
  /** Gewählte Ziele als Zahlen (1–20, 25 = Bullseye). Fehlt die Angabe (ältere Spiele), gelten alle 21. */
  targets?: number[];
}

export const DEFAULT_DOUBLES: DoublesSettings = {
  sequence: 'own',
  mode: { kind: 'untilHit' },
  targets: [...Array.from({ length: 20 }, (_, i) => i + 1), 25],
};

export interface DoublesSetup {
  gameId: string;
  settings: DoublesSettings;
  order: number[];
  /** Zufallswert aus game.created; daraus entsteht die Zielfolge. */
  seed: number;
}

/** Die 21 Ziele: D1–D20 und Bullseye (beim Bull zählt nur das Bullseye). */
export const DOUBLE_TARGETS: Field[] = [...Array.from({ length: 20 }, (_, i) => ({ n: i + 1, m: 2 as const })), { n: BULL, m: 2 }];

/** Die gewählten Ziele in fester Grundreihenfolge (D1 … D20, DB), vor dem Mischen. */
export function targetsOf(s: DoublesSettings): Field[] {
  return s.targets ? DOUBLE_TARGETS.filter((f) => s.targets!.includes(f.n)) : DOUBLE_TARGETS;
}

export function validateDoubles(s: DoublesSettings): string[] {
  if (s.targets && !targetsOf(s).length) return ['Mindestens ein Ziel wählen.'];
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
export function shuffledTargets(seed: number, targets: readonly Field[] = DOUBLE_TARGETS): Field[] {
  const rnd = random(seed);
  const list = [...targets];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Zielfolge eines Spielers: gemeinsam aus dem Spiel-Seed, sonst je Platz ein abgeleiteter Seed. */
export function sequenceFor(setup: DoublesSetup, slot: number): Field[] {
  const seed = setup.settings.sequence === 'shared' ? setup.seed : setup.seed + (slot + 1) * 7919;
  return shuffledTargets(seed, targetsOf(setup.settings));
}

export interface FieldStats {
  darts: number;
  hits: number;
}

export interface DoublesPlayer {
  sequence: Field[];
  /** Position in der Zielfolge (0 bis Anzahl Ziele; am Ende = fertig). */
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
  /** „Spiel beenden“, nachdem der Erste fertig war: alle gelten als fertig. */
  stopped?: boolean;
}

export interface DoublesTurnData {
  hits: number;
}

export type DoublesTurn = CoreTurn<DoublesTurnData>;
export type DoublesState = CoreState<DoublesLegState, DoublesTurnData> & {
  setup: DoublesSetup;
  players: Record<number, DoublesPlayer>;
  /** Frage „Weiterspielen oder Spiel beenden?“ steht an: der Erste ist fertig, andere nicht, noch nicht beantwortet. */
  askEnd: boolean;
};

export function currentTarget(p: DoublesPlayer): Field | null {
  return p.index < p.sequence.length ? p.sequence[p.index] : null;
}

function doublesRules(setup: DoublesSetup, stopAt: string | null): Rules<DoublesLegState, DoublesTurnData> {
  const { settings: s, order } = setup;
  const fixed = s.mode.kind === 'fixed' ? s.mode.darts : null;
  const done = (p: DoublesPlayer) => p.index >= p.sequence.length;
  const isDone = (ls: DoublesLegState, slot: number) => !!ls.stopped || done(ls.players[slot]);

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
    newTurn: (ls, slot, turnIndex) => {
      // „Spiel beenden“ vor dieser Aufnahme
      if (stopAt === `${slot}|${turnIndex}`) ls.stopped = true;
      return { hits: 0 };
    },
    isDone,
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
      if (!at.afterTurn || !order.every((slot) => isDone(ls, slot))) return null;
      // Bis zum Treffer: mehr Ziele (nur nach „Spiel beenden“ verschieden), dann wenigste Darts.
      // Feste Zahl: meiste Treffer. Gleichstand = geteilter Platz.
      const p = (slot: number) => ls.players[slot];
      const score = (slot: number) => (fixed === null ? p(slot).index * 1_000_000 - p(slot).darts : p(slot).hits);
      const best = Math.max(...order.map(score));
      return order.filter((slot) => score(slot) === best);
    },
    autoMiss: () => ({ field: null, hit: false }),
  };
}

export function computeDoubles(setup: DoublesSetup, events: readonly GameEvent[]): DoublesState {
  const end = collectEnd(setup.gameId, events);
  const core = computeCore(doublesRules(setup, end.stopAt), events);
  const players = core.legs[0].state.players;
  const pos = core.next;
  const finished = setup.order.filter((slot) => players[slot].index >= players[slot].sequence.length).length;
  const askEnd = !!pos && pos.dartIndex === 1 && !end.answered && finished > 0 && finished < setup.order.length;
  return { ...core, setup, players, askEnd };
}

/** Antwort auf „Weiterspielen oder Spiel beenden?“ (SPEC 7.4 Regel 7). */
export function decideDoublesEnd(state: DoublesState, end: boolean): NewEvent[] {
  return state.askEnd ? decideEnd(state, end) : [];
}

/** Treffer oder Falsch für das aktuelle Ziel des Spielers, der dran ist. */
export function throwDoublesDart(state: DoublesState, hit: boolean, input: DartPayload['input'] = 'hitmiss'): NewEvent | null {
  const slot = state.next?.slot;
  if (slot === undefined) return null;
  const target = currentTarget(state.players[slot]);
  if (!target) return null;
  const d: DartInput = { field: hit ? target : null, hit };
  const ev = throwDartCore(state, { acceptsDart: () => true }, d, input);
  if (ev?.type === 'dart.thrown') ev.payload.target = target;
  return ev;
}

export function confirmDoublesTurn(state: DoublesState): NewEvent[] {
  return confirmTurnCore(state, { autoMiss: () => ({ field: null, hit: false }) });
}

/** Rückgängig nimmt das Letzte zurück: eine Antwort auf die Beenden-Frage oder (wie sonst) Dart bzw. Weiter. */
export function undoDoubles(state: DoublesState, events: readonly GameEvent[] = []): NewEvent[] {
  const answers = new Set(collectEnd(state.gameId, events).ids);
  const lastAction = state.actions[state.actions.length - 1]?.id;
  for (let i = events.length - 1; i >= 0; i--) {
    const id = events[i].id;
    if (answers.has(id)) return [{ type: 'event.voided', payload: { gameId: state.gameId, targetId: id, reason: 'undo' } }];
    if (id === lastAction) break;
  }
  return undoCore(state);
}

/** Trefferquote in Prozent mit einer Nachkommastelle, „—“ ohne Würfe (SPEC 11.1). */
export function quote(hits: number, darts: number): string {
  return darts ? `${((hits / darts) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '—';
}
