// 121 (neue Form, Wunsch Gianluca 26.10.2026): Je Runde eine zufällige, checkbare Restzahl zwischen 70 und 170.
// 70–99: höchstens 6 Darts (2 Aufnahmen), 100–170: höchstens 9 Darts (3 Aufnahmen) je Versuch.
// Nicht geschafft → dieselbe Zahl noch einmal; geschafft → nächste Runde. Vor einer Aufnahme darf man die Zahl
// überspringen (zählt als nicht geschafft). Bust und Out wie bei X01.

import { suggestCheckout } from './checkout';
import {
  collectEnd,
  computeCore,
  confirmTurnCore,
  decideEnd,
  planEditCore,
  throwDartCore,
  undoCore,
  type CoreState,
  type EditPlan,
  type Rules,
  type Turn as CoreTurn,
} from './core';
import { voidedIds, type DartPayload, type GameEvent, type NewEvent } from './events';
import { isValidField, points, type Field } from './types';

export interface FinishSettings {
  /** Runden = Zahlen, die jeder schaffen bzw. überspringen muss (1–50). */
  rounds: number;
  /** Alle dieselben Zufallszahlen oder jeder seine eigenen. */
  sequence: 'shared' | 'own';
  outMode: 'double' | 'master';
}

export const DEFAULT_FINISH: FinishSettings = { rounds: 10, sequence: 'shared', outMode: 'double' };
export const FINISH_MIN = 70;
export const FINISH_MAX = 170;

export interface FinishSetup {
  gameId: string;
  settings: FinishSettings;
  order: number[];
  seed: number;
}

export function validateFinish(s: FinishSettings): string[] {
  return Number.isInteger(s.rounds) && s.rounds >= 1 && s.rounds <= 50 ? [] : ['Runden 1 bis 50.'];
}

const pools = new Map<FinishSettings['outMode'], number[]>();

/** Alle Restzahlen 70–170, die mit 3 Darts checkbar sind (einmal je Out-Art berechnet). */
export function finishPool(out: FinishSettings['outMode']): number[] {
  let pool = pools.get(out);
  if (!pool) {
    pool = [];
    for (let n = FINISH_MIN; n <= FINISH_MAX; n++) if (suggestCheckout(n, 3, out, 'expert')) pool.push(n);
    pools.set(out, pool);
  }
  return pool;
}

/** Darts je Versuch: unter 100 sind es 6, ab 100 sind es 9. */
export const dartsFor = (target: number) => (target < 100 ? 6 : 9);

/** Kleiner, fester Zufallsgenerator (mulberry32): gleicher Seed → gleiche Zahlen auf jedem Gerät. */
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

/** Zahlenfolge eines Spielers: gemeinsam aus dem Spiel-Seed, sonst je Platz ein abgeleiteter Seed. */
export function finishSequence(setup: FinishSetup, slot: number): number[] {
  const seed = setup.settings.sequence === 'shared' ? setup.seed : setup.seed + (slot + 1) * 7919;
  const rnd = random(seed);
  const pool = finishPool(setup.settings.outMode);
  return Array.from({ length: setup.settings.rounds }, () => pool[Math.floor(rnd() * pool.length)]);
}

/** Ergebnis einer Runde (Grundlage für die spätere Statistik je Finish-Bereich). */
export interface FinishRound {
  target: number;
  /** Versuche (auch der laufende bzw. abgebrochene). */
  attempts: number;
  darts: number;
  success: boolean;
  skipped: boolean;
}

export interface FinishPlayer {
  /** Laufende Runde (ab 0); = Rundenzahl heißt fertig. */
  round: number;
  rest: number;
  /** Abgeschlossene Aufnahmen im laufenden Versuch. */
  turnsUsed: number;
  results: FinishRound[];
}

export interface FinishTurnData {
  target: number;
  round: number;
  attempt: number;
  turnOfAttempt: number;
  maxTurns: number;
  startRest: number;
  endRest: number;
  bust: boolean;
  checkout: boolean;
  /** Der Versuch endet mit dieser Aufnahme ohne Checkout. */
  failed: boolean;
}

export interface FinishLegState {
  players: Record<number, FinishPlayer>;
  /** „Spiel beenden“, nachdem der Erste fertig war: alle gelten als fertig. */
  stopped?: boolean;
}

export type FinishTurn = CoreTurn<FinishTurnData>;
export type FinishState = CoreState<FinishLegState, FinishTurnData> & {
  setup: FinishSetup;
  players: Record<number, FinishPlayer>;
  sequences: Record<number, number[]>;
  /** Überspringen vor der Aufnahme, die gerade dran ist, erlaubt (noch kein Dart in dieser Aufnahme). */
  canSkip: boolean;
  /** Frage „Weiterspielen oder Spiel beenden?“ steht an: der Erste ist fertig, andere nicht, noch nicht beantwortet. */
  askEnd: boolean;
};

const qualifiesOut = (out: FinishSettings['outMode'], f: Field) => (out === 'double' ? f.m === 2 : f.m >= 2);
const skipKey = (slot: number, turnIndex: number) => `${slot}|${turnIndex}`;

/**
 * Gültige „Überspringen“-Antworten: Platz|Aufnahme → Ereignis-IDs in Reihenfolge.
 * Mehrere Zahlen hintereinander überspringen (ohne Dart dazwischen) ergibt mehrere Antworten vor derselben Aufnahme.
 */
function collectSkips(gameId: string, events: readonly GameEvent[]): Map<string, string[]> {
  const voided = voidedIds(events);
  const map = new Map<string, string[]>();
  for (const e of events) {
    if (e.type !== 'game.decision' || voided.has(e.id) || e.payload.gameId !== gameId || e.payload.kind !== 'skip') continue;
    const k = skipKey(e.payload.slot, e.payload.turnIndex);
    map.set(k, [...(map.get(k) ?? []), e.id]);
  }
  return map;
}

function finishRules(setup: FinishSetup, skips: Map<string, string[]>, stopAt: string | null): Rules<FinishLegState, FinishTurnData> {
  const { settings: s, order } = setup;
  const seqs = Object.fromEntries(order.map((slot) => [slot, finishSequence(setup, slot)]));
  const isDone = (ls: FinishLegState, slot: number) => !!ls.stopped || ls.players[slot].round >= s.rounds;

  const current = (p: FinishPlayer) => p.results[p.round];
  /** Weiter zur nächsten Runde (nach Erfolg oder Überspringen). */
  const nextRound = (p: FinishPlayer, slot: number) => {
    p.round++;
    p.turnsUsed = 0;
    if (p.round < s.rounds) {
      const target = seqs[slot][p.round];
      p.rest = target;
      p.results.push({ target, attempts: 1, darts: 0, success: false, skipped: false });
    }
  };

  return {
    gameId: setup.gameId,
    order,
    format: null,
    newLeg: () => ({
      players: Object.fromEntries(
        order.map((slot) => {
          const target = seqs[slot][0];
          return [slot, { round: 0, rest: target, turnsUsed: 0, results: [{ target, attempts: 1, darts: 0, success: false, skipped: false }] }];
        }),
      ),
    }),
    newTurn: (ls, slot, turnIndex) => {
      const p = ls.players[slot];
      // „Spiel beenden“ vor dieser Aufnahme: angefangene Zahlen bleiben offen
      if (stopAt === skipKey(slot, turnIndex)) ls.stopped = true;
      // „Zahl überspringen“ vor dieser Aufnahme, auch mehrmals hintereinander
      for (const _ of skips.get(skipKey(slot, turnIndex)) ?? []) {
        if (isDone(ls, slot)) break;
        current(p).skipped = true;
        nextRound(p, slot);
      }
      const r = current(p);
      const target = r?.target ?? 0;
      return {
        target,
        round: p.round + 1,
        attempt: r?.attempts ?? 1,
        turnOfAttempt: p.turnsUsed + 1,
        maxTurns: dartsFor(target) / 3,
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
      const r = current(p);
      const f = d.field!;
      const scored = points(f);
      r.darts++;
      const after = turn.endRest - scored;
      const bust = after < 0 || after === 1 || (after === 0 && !qualifiesOut(s.outMode, f));
      if (!bust && after === 0) {
        turn.endRest = 0;
        turn.checkout = true;
        r.success = true;
        nextRound(p, turn.slot);
        return { scored, endsTurn: true };
      }
      if (bust) {
        turn.bust = true;
        turn.endRest = turn.startRest;
      } else {
        turn.endRest = after;
      }
      p.rest = turn.endRest;
      if (bust || dartIndex === 3) {
        p.turnsUsed++;
        if (p.turnsUsed >= turn.maxTurns) {
          // Versuch vorbei: dieselbe Zahl noch einmal
          turn.failed = true;
          p.turnsUsed = 0;
          p.rest = r.target;
          r.attempts++;
        }
      }
      return { scored, endsTurn: bust };
    },
    winners: (ls, at) => {
      if (!at.afterTurn || !order.every((slot) => isDone(ls, slot))) return null;
      // Meiste geschaffte Zahlen, dann wenigste Darts; Gleichstand = geteilter Sieg
      const done = (slot: number) => ls.players[slot].results.filter((r) => r.success).length;
      const darts = (slot: number) => ls.players[slot].results.reduce((n, r) => n + r.darts, 0);
      const score = (slot: number) => done(slot) * 100_000 - darts(slot);
      const best = Math.max(...order.map(score));
      return order.filter((slot) => score(slot) === best);
    },
  };
}

export function computeFinish(setup: FinishSetup, events: readonly GameEvent[]): FinishState {
  const skips = collectSkips(setup.gameId, events);
  const end = collectEnd(setup.gameId, events);
  const core = computeCore(finishRules(setup, skips, end.stopAt), events);
  const players = core.legs[0].state.players;
  const pos = core.next;
  const done = setup.order.filter((slot) => players[slot].round >= setup.settings.rounds).length;
  const askEnd = !!pos && pos.dartIndex === 1 && !end.answered && done > 0 && done < setup.order.length;
  return {
    ...core,
    setup,
    players,
    sequences: Object.fromEntries(setup.order.map((slot) => [slot, finishSequence(setup, slot)])),
    canSkip: !!pos && pos.dartIndex === 1 && !askEnd,
    askEnd,
  };
}

/** Antwort auf „Weiterspielen oder Spiel beenden?“ vor der Aufnahme, die gerade dran ist. */
export function decideFinishEnd(state: FinishState, end: boolean): NewEvent[] {
  return state.askEnd ? decideEnd(state, end) : [];
}

export function throwFinishDart(state: FinishState, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  return throwDartCore(state, {}, { field }, input);
}

export function confirmFinishTurn(state: FinishState): NewEvent[] {
  return confirmTurnCore(state, {});
}

/** „Zahl überspringen“: vor der nächsten Aufnahme des Spielers, der dran ist. */
export function skipFinish(state: FinishState): NewEvent[] {
  const pos = state.next;
  if (!pos || !state.canSkip) return [];
  return [{ type: 'game.decision', payload: { gameId: state.gameId, slot: pos.slot, turnIndex: pos.turnIndex, kind: 'skip' } }];
}

/** Rückgängig nimmt das Letzte zurück: ein Überspringen, eine Antwort auf die Beenden-Frage oder (wie sonst) Dart bzw. Weiter. */
export function undoFinish(state: FinishState, events: readonly GameEvent[]): NewEvent[] {
  const skipIds = new Set([...[...collectSkips(state.gameId, events).values()].flat(), ...collectEnd(state.gameId, events).ids]);
  const lastAction = state.actions[state.actions.length - 1]?.id;
  for (let i = events.length - 1; i >= 0; i--) {
    const id = events[i].id;
    if (skipIds.has(id)) return [{ type: 'event.voided', payload: { gameId: state.gameId, targetId: id, reason: 'undo' } }];
    if (id === lastAction) break;
  }
  return undoCore(state);
}

export function planFinishEdit(
  state: FinishState,
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
    (evs) => computeFinish(state.setup, evs),
    (t) => `${t.bust}|${t.checkout}|${t.failed}`,
  );
}
