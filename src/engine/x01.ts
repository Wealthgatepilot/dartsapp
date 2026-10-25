// X01 nach SPEC 7.1. Reine Funktionen: Aus Einstellungen und Ereignissen wird der Spielstand berechnet.
// Befehle (werfen, Weiter, Rückgängig, Runde bearbeiten) erzeugen nur neue Ereignisse, sie ändern nichts.

import { voidedIds, type DartPayload, type GameEvent, type NewEvent } from './events';
import { MISS, isValidField, points, type Field } from './types';

export type InOut = 'single' | 'double' | 'master';

export interface Race {
  count: number;
  kind: 'firstTo' | 'bestOf';
}

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
}

export interface DartView {
  id: string;
  dartIndex: number;
  field: Field;
  /** Punkte dieses Darts nach der In-Regel (0, solange der Spieler nicht drin ist). Bei Bust zählt die Aufnahme trotzdem 0. */
  scored: number;
  input: DartPayload['input'];
}

export interface Turn {
  leg: number;
  set: number;
  slot: number;
  turnIndex: number;
  darts: DartView[];
  startRemaining: number;
  endRemaining: number;
  startIn: boolean;
  endIn: boolean;
  bust: boolean;
  checkout: boolean;
  /** Keine weiteren Darts möglich (3 Darts, Bust, Checkout oder bestätigt). */
  complete: boolean;
  /** Mit „Weiter“ bestätigt (oder ein späterer Wurf existiert). */
  confirmed: boolean;
  confirmId?: string;
}

export interface Leg {
  leg: number;
  set: number;
  /** Wurfreihenfolge in diesem Leg, beginnend mit dem Anwerfer. */
  order: number[];
  turns: Turn[];
  winner: number | null;
}

export interface Position {
  leg: number;
  set: number;
  slot: number;
  turnIndex: number;
  dartIndex: number;
}

export interface X01State {
  setup: X01Setup;
  legs: Leg[];
  /** Rest und In-Status je Platz im aktuellen (letzten) Leg. */
  remaining: Record<number, number>;
  isIn: Record<number, boolean>;
  legsWon: Record<number, number>;
  /** Gewonnene Legs im laufenden Set (ohne Sets = gleich legsWon). */
  legsWonInSet: Record<number, number>;
  setsWon: Record<number, number>;
  matchWinner: number | null;
  /** Wohin der nächste Dart gehört. null = Weiter fehlt oder Spiel vorbei. */
  next: Position | null;
  /** Die Aufnahme, die gerade läuft oder auf „Weiter“ wartet. */
  currentTurn: Turn | null;
  awaitingConfirm: boolean;
  /** Darts, die nach den Regeln nicht möglich sind (SPEC 3.5). Sie bleiben gespeichert. */
  ignored: { id: string; reason: string }[];
  /** Alle wirksamen Aktionen in Spielreihenfolge, für Rückgängig. */
  actions: { kind: 'dart' | 'confirm'; id: string; turn: Turn }[];
}

// ---------- Einstellungen ----------

export function winsNeeded(r: Race): number {
  return r.kind === 'firstTo' ? r.count : Math.floor(r.count / 2) + 1;
}

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

// ---------- Berechnung ----------

type Rank = [leg: number, turnIndex: number, orderIndex: number];

function legOrder(order: number[], leg: number): number[] {
  const k = (leg - 1) % order.length;
  return [...order.slice(k), ...order.slice(0, k)];
}

function compareRank(a: Rank, b: Rank): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

const key = (leg: number, slot: number, turnIndex: number) => `${leg}|${slot}|${turnIndex}`;

export function computeX01(setup: X01Setup, events: readonly GameEvent[]): X01State {
  const { settings, order } = setup;
  const voided = voidedIds(events);
  const ignored: X01State['ignored'] = [];

  // 1. Darts und Bestätigungen nach Position einsortieren.
  const darts = new Map<string, Map<number, GameEvent & { type: 'dart.thrown' }>>();
  const confirms = new Map<string, GameEvent & { type: 'turn.confirmed' }>();
  let maxRank: Rank | null = null;
  const noteRank = (leg: number, slot: number, turnIndex: number) => {
    const idx = legOrder(order, leg).indexOf(slot);
    if (idx < 0) return;
    const r: Rank = [leg, turnIndex, idx];
    if (!maxRank || compareRank(r, maxRank) > 0) maxRank = r;
  };

  for (const e of events) {
    if (voided.has(e.id)) continue;
    if (e.type === 'dart.thrown') {
      const p = e.payload;
      if (p.gameId !== setup.gameId) continue;
      if (!p.field || !isValidField(p.field) || p.dartIndex < 1 || p.dartIndex > 3 || !order.includes(p.slot)) {
        ignored.push({ id: e.id, reason: 'ungültige Angaben' });
        continue;
      }
      const k = key(p.leg, p.slot, p.turnIndex);
      let turn = darts.get(k);
      if (!turn) darts.set(k, (turn = new Map()));
      const prev = turn.get(p.dartIndex);
      if (prev) ignored.push({ id: prev.id, reason: 'Position doppelt belegt' });
      turn.set(p.dartIndex, e);
      noteRank(p.leg, p.slot, p.turnIndex);
    } else if (e.type === 'turn.confirmed') {
      const p = e.payload;
      if (p.gameId !== setup.gameId) continue;
      confirms.set(key(p.leg, p.slot, p.turnIndex), e);
      noteRank(p.leg, p.slot, p.turnIndex);
    }
  }

  const used = new Set<string>();
  const state: X01State = {
    setup,
    legs: [],
    remaining: {},
    isIn: {},
    legsWon: Object.fromEntries(order.map((s) => [s, 0])),
    legsWonInSet: Object.fromEntries(order.map((s) => [s, 0])),
    setsWon: Object.fromEntries(order.map((s) => [s, 0])),
    matchWinner: null,
    next: null,
    currentTurn: null,
    awaitingConfirm: false,
    ignored,
    actions: [],
  };

  // 2. Legs der Reihe nach durchspielen.
  let setNo = 1;
  replay: for (let legNo = 1; ; legNo++) {
    const lo = legOrder(order, legNo);
    const leg: Leg = { leg: legNo, set: setNo, order: lo, turns: [], winner: null };
    state.legs.push(leg);
    for (const s of order) {
      state.remaining[s] = setup.startScores?.[s] ?? settings.startScore;
      state.isIn[s] = settings.inMode === 'single';
    }

    for (let round = 1; ; round++) {
      for (let oi = 0; oi < lo.length; oi++) {
        const slot = lo[oi];
        const k = key(legNo, slot, round);
        const turnDarts = darts.get(k);
        const confirm = confirms.get(k);
        const hasLater = maxRank !== null && compareRank(maxRank, [legNo, round, oi]) > 0;

        if (!turnDarts && !confirm) {
          if (hasLater) {
            // Lücke: Diese Aufnahme fehlt, spätere existieren. Alles Spätere ist nicht nachvollziehbar.
            break replay;
          }
          const turn = newTurn(leg, slot, round, state);
          state.currentTurn = turn;
          state.next = { leg: legNo, set: setNo, slot, turnIndex: round, dartIndex: 1 };
          break replay;
        }

        const turn = newTurn(leg, slot, round, state);
        playTurn(turn, turnDarts, settings, state, used);
        if (confirm) {
          turn.confirmId = confirm.id;
          used.add(confirm.id);
        }
        const maxIndex = turn.darts.length ? turn.darts[turn.darts.length - 1].dartIndex : 0;
        turn.complete = turn.bust || turn.checkout || maxIndex >= 3 || !!confirm || hasLater;
        turn.confirmed = !!confirm || hasLater;
        leg.turns.push(turn);
        state.remaining[slot] = turn.endRemaining;
        state.isIn[slot] = turn.endIn;
        if (confirm) state.actions.push({ kind: 'confirm', id: confirm.id, turn });

        if (turn.checkout) {
          leg.winner = slot;
          state.legsWon[slot]++;
          state.legsWonInSet[slot]++;
          if (settings.sets) {
            if (state.legsWonInSet[slot] >= winsNeeded(settings.legs)) {
              state.setsWon[slot]++;
              if (state.setsWon[slot] >= winsNeeded(settings.sets)) state.matchWinner = slot;
            }
          } else if (state.legsWon[slot] >= winsNeeded(settings.legs)) {
            state.matchWinner = slot;
          }
        }

        if (!turn.complete) {
          state.currentTurn = turn;
          state.next = { leg: legNo, set: setNo, slot, turnIndex: round, dartIndex: maxIndex + 1 };
          break replay;
        }
        if (!turn.confirmed) {
          state.currentTurn = turn;
          state.awaitingConfirm = true;
          break replay;
        }
        if (turn.checkout) {
          if (state.matchWinner !== null) {
            state.currentTurn = turn;
            break replay;
          }
          if (settings.sets && state.legsWonInSet[slot] >= winsNeeded(settings.legs)) {
            setNo++;
            for (const s of order) state.legsWonInSet[s] = 0;
          }
          continue replay;
        }
      }
    }
  }

  // 3. Alles, was nicht verwendet wurde, ist nach den Regeln nicht möglich.
  const alreadyIgnored = new Set(ignored.map((i) => i.id));
  for (const turn of darts.values()) {
    for (const e of turn.values()) {
      if (!used.has(e.id) && !alreadyIgnored.has(e.id)) ignored.push({ id: e.id, reason: 'kein Platz im Spielverlauf' });
    }
  }
  for (const e of confirms.values()) {
    if (!used.has(e.id)) ignored.push({ id: e.id, reason: 'Bestätigung ohne Aufnahme' });
  }
  return state;
}

function newTurn(leg: Leg, slot: number, turnIndex: number, state: X01State): Turn {
  return {
    leg: leg.leg,
    set: leg.set,
    slot,
    turnIndex,
    darts: [],
    startRemaining: state.remaining[slot],
    endRemaining: state.remaining[slot],
    startIn: state.isIn[slot],
    endIn: state.isIn[slot],
    bust: false,
    checkout: false,
    complete: false,
    confirmed: false,
  };
}

/** Wendet die Darts einer Aufnahme nach SPEC 7.1 an. */
function playTurn(
  turn: Turn,
  turnDarts: Map<number, GameEvent & { type: 'dart.thrown' }> | undefined,
  settings: X01Settings,
  state: X01State,
  used: Set<string>,
): void {
  if (!turnDarts) return;
  let rem = turn.startRemaining;
  let isIn = turn.startIn;
  const indices = [...turnDarts.keys()].sort((a, b) => a - b);
  for (const idx of indices) {
    const e = turnDarts.get(idx)!;
    if (turn.bust || turn.checkout) {
      state.ignored.push({ id: e.id, reason: 'nach Bust oder Checkout' });
      continue;
    }
    const field = e.payload.field!;
    used.add(e.id);
    let scored = 0;
    if (!isIn && qualifiesIn(settings.inMode, field)) isIn = true;
    if (isIn) {
      scored = points(field);
      const after = rem - scored;
      const bust =
        after < 0 ||
        (after === 1 && settings.outMode !== 'single') ||
        (after === 0 && !qualifiesOut(settings.outMode, field));
      if (bust) {
        turn.bust = true;
      } else {
        rem = after;
        if (rem === 0) turn.checkout = true;
      }
    }
    const view: DartView = { id: e.id, dartIndex: idx, field, scored, input: e.payload.input };
    turn.darts.push(view);
    state.actions.push({ kind: 'dart', id: e.id, turn });
  }
  if (turn.bust) {
    turn.endRemaining = turn.startRemaining;
    turn.endIn = turn.startIn;
  } else {
    turn.endRemaining = rem;
    turn.endIn = isIn;
  }
}

// ---------- Befehle ----------

/** Trägt einen Dart an der nächsten freien Position ein. null, wenn gerade kein Dart möglich ist. */
export function throwDart(state: X01State, field: Field, input: DartPayload['input'] = 'board'): NewEvent | null {
  const pos = state.next;
  if (!pos || !isValidField(field)) return null;
  return {
    type: 'dart.thrown',
    payload: { gameId: state.setup.gameId, ...pos, field, input },
  };
}

/** „Weiter“: füllt fehlende Darts als daneben auf (SPEC 3.4) und bestätigt die Aufnahme. */
export function confirmTurn(state: X01State): NewEvent[] {
  const t = state.currentTurn;
  if (!t || t.confirmed) return [];
  const out: NewEvent[] = [];
  if (!t.bust && !t.checkout) {
    const maxIndex = t.darts.length ? t.darts[t.darts.length - 1].dartIndex : 0;
    for (let i = maxIndex + 1; i <= 3; i++) {
      out.push({
        type: 'dart.thrown',
        payload: {
          gameId: state.setup.gameId,
          slot: t.slot,
          leg: t.leg,
          set: t.set,
          turnIndex: t.turnIndex,
          dartIndex: i,
          field: MISS,
          input: 'auto',
        },
      });
    }
  }
  out.push({
    type: 'turn.confirmed',
    payload: { gameId: state.setup.gameId, leg: t.leg, slot: t.slot, turnIndex: t.turnIndex },
  });
  return out;
}

/** Rückgängig: letzter Dart, oder letztes „Weiter“ samt aufgefüllter Darts (SPEC 5.1). */
export function undo(state: X01State): NewEvent[] {
  const last = state.actions[state.actions.length - 1];
  if (!last) return [];
  const ids = [last.id];
  if (last.kind === 'confirm') {
    for (const d of last.turn.darts) if (d.input === 'auto') ids.push(d.id);
  }
  return ids.map((targetId) => ({ type: 'event.voided', payload: { gameId: state.setup.gameId, targetId, reason: 'undo' } }));
}

export interface EditPlan {
  events: NewEvent[];
  /** Darts, die durch die Änderung keinen Platz mehr haben und verworfen werden (SPEC 5.2). */
  discarded: string[];
  /** Wird die bearbeitete Aufnahme dadurch zum Bust oder Checkout bzw. hört auf, einer zu sein? */
  outcomeChanged: boolean;
  error?: string;
}

/**
 * Runde bearbeiten: ersetzt die Darts einer Aufnahme im laufenden Leg durch `fields`.
 * Liefert die nötigen Ereignisse und, welche späteren Darts dadurch verworfen würden.
 */
export function planEdit(
  state: X01State,
  events: readonly GameEvent[],
  target: { leg: number; slot: number; turnIndex: number },
  fields: Field[],
): EditPlan {
  const leg = state.legs[state.legs.length - 1];
  const empty: EditPlan = { events: [], discarded: [], outcomeChanged: false };
  if (!leg || leg.leg !== target.leg) return { ...empty, error: 'Nur Aufnahmen im laufenden Leg sind bearbeitbar.' };
  const turn = leg.turns.find((t) => t.slot === target.slot && t.turnIndex === target.turnIndex);
  if (!turn) return { ...empty, error: 'Diese Aufnahme gibt es nicht.' };
  if (fields.length > 3 || !fields.every(isValidField)) return { ...empty, error: 'Höchstens 3 gültige Darts.' };

  const out: NewEvent[] = [];
  fields.forEach((field, i) => {
    const old = turn.darts[i];
    if (old && old.dartIndex === i + 1 && old.field.n === field.n && old.field.m === field.m) return;
    if (old) out.push({ type: 'event.voided', payload: { gameId: state.setup.gameId, targetId: old.id, reason: 'edit' } });
    out.push({
      type: 'dart.thrown',
      payload: {
        gameId: state.setup.gameId,
        slot: turn.slot,
        leg: turn.leg,
        set: turn.set,
        turnIndex: turn.turnIndex,
        dartIndex: i + 1,
        field,
        input: 'board',
        ...(old ? { replaces: old.id } : {}),
      },
    });
  });
  for (const old of turn.darts.slice(fields.length)) {
    out.push({ type: 'event.voided', payload: { gameId: state.setup.gameId, targetId: old.id, reason: 'edit' } });
  }

  // Simulieren: Wie sieht das Spiel danach aus?
  let simulated = simulate(state.setup, events, out);
  const simTurn = findTurn(simulated, turn);
  if (turn.confirmed && simTurn && !simTurn.bust && !simTurn.checkout && simTurn.darts.length < 3) {
    for (let i = simTurn.darts.length + 1; i <= 3; i++) {
      out.push({
        type: 'dart.thrown',
        payload: {
          gameId: state.setup.gameId,
          slot: turn.slot,
          leg: turn.leg,
          set: turn.set,
          turnIndex: turn.turnIndex,
          dartIndex: i,
          field: MISS,
          input: 'auto',
        },
      });
    }
    simulated = simulate(state.setup, events, out);
  }

  const before = new Set(state.ignored.map((i) => i.id));
  const discarded = simulated.ignored.map((i) => i.id).filter((id) => !before.has(id) && !id.startsWith(TMP));
  for (const id of discarded) out.push({ type: 'event.voided', payload: { gameId: state.setup.gameId, targetId: id, reason: 'edit' } });

  const after = findTurn(simulate(state.setup, events, out), turn);
  // „Ausgang“ heißt Bust oder Checkout (SPEC 5.2), nicht jede Punktänderung.
  const outcomeChanged = !after || after.bust !== turn.bust || after.checkout !== turn.checkout;
  return { events: out, discarded, outcomeChanged };
}

const TMP = 'tmp-';

function simulate(setup: X01Setup, events: readonly GameEvent[], extra: NewEvent[]): X01State {
  const added = extra.map((e, i) => ({ ...e, id: `${TMP}${i}`, ts: 0 }) as GameEvent);
  return computeX01(setup, [...events, ...added]);
}

function findTurn(state: X01State, t: Turn): Turn | undefined {
  return state.legs.find((l) => l.leg === t.leg)?.turns.find((x) => x.slot === t.slot && x.turnIndex === t.turnIndex);
}
