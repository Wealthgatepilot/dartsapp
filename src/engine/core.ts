// Gemeinsames Gerüst aller Spielmodi mit Aufnahmen (SPEC 3, 5).
// Es kümmert sich um: Reihenfolge, Legs und Sets, Position jedes Darts, „Weiter“, Rückgängig,
// Runde bearbeiten und unmögliche Darts. Jeder Modus liefert nur seine Regeln (`Rules`).

import { voidedIds, type DartPayload, type GameEvent, type NewEvent } from './events';
import { MISS, isValidField, type Field } from './types';

export interface Race {
  count: number;
  kind: 'firstTo' | 'bestOf';
}

export interface MatchFormat {
  legs: Race;
  /** null = nur Legs, keine Sets. */
  sets: Race | null;
}

export function winsNeeded(r: Race): number {
  return r.kind === 'firstTo' ? r.count : Math.floor(r.count / 2) + 1;
}

export interface DartView {
  id: string;
  dartIndex: number;
  /** Feld des Darts. Bei „Falsch“ aus der Treffer/Falsch-Eingabe unbekannt: dann MISS mit known = false. */
  field: Field;
  known: boolean;
  /** Nur bei Trainings: Ziel getroffen? */
  hit?: boolean;
  /** Punkte bzw. Wert dieses Darts nach den Regeln des Modus. */
  scored: number;
  input: DartPayload['input'];
}

export interface TurnBase {
  leg: number;
  set: number;
  slot: number;
  turnIndex: number;
  darts: DartView[];
  /** Die Regeln lassen in dieser Aufnahme keinen weiteren Dart zu (z. B. Bust, Checkout, Leg gewonnen). */
  ended: boolean;
  /** Keine weiteren Darts möglich (3 Darts, Ende nach Regeln oder bestätigt). */
  complete: boolean;
  /** Mit „Weiter“ bestätigt (oder ein späterer Wurf existiert). */
  confirmed: boolean;
  confirmId?: string;
}

export type Turn<TD> = TurnBase & TD;

export interface Leg<LS, TD> {
  leg: number;
  set: number;
  /** Wurfreihenfolge in diesem Leg, beginnend mit dem Anwerfer. */
  order: number[];
  turns: Turn<TD>[];
  /** Gewinner des Legs bzw. Durchgangs; mehrere bei Gleichstand; null = läuft noch. */
  winners: number[] | null;
  /** Einziger Gewinner, sonst null (für Modi, die keinen Gleichstand kennen). */
  winner: number | null;
  /** Stand nach den Regeln des Modus (Reste, Marks, Punkte …). */
  state: LS;
}

export interface Position {
  leg: number;
  set: number;
  slot: number;
  turnIndex: number;
  dartIndex: number;
}

export interface CoreState<LS, TD> {
  gameId: string;
  format: MatchFormat | null;
  order: number[];
  legs: Leg<LS, TD>[];
  legsWon: Record<number, number>;
  /** Gewonnene Legs im laufenden Set (ohne Sets = gleich legsWon). */
  legsWonInSet: Record<number, number>;
  setsWon: Record<number, number>;
  /** Spiel vorbei. */
  finished: boolean;
  /** Alle Gewinner des Spiels (mehrere bei Gleichstand). */
  matchWinners: number[] | null;
  /** Einziger Gewinner, sonst null. */
  matchWinner: number | null;
  /** Wohin der nächste Dart gehört. null = Weiter fehlt oder Spiel vorbei. */
  next: Position | null;
  /** Die Aufnahme, die gerade läuft oder auf „Weiter“ wartet. */
  currentTurn: Turn<TD> | null;
  awaitingConfirm: boolean;
  /** Darts, die nach den Regeln nicht möglich sind (SPEC 3.5). Sie bleiben gespeichert. */
  ignored: { id: string; reason: string }[];
  /** Alle wirksamen Aktionen in Spielreihenfolge, für Rückgängig. */
  actions: { kind: 'dart' | 'confirm'; id: string; turn: Turn<TD> }[];
  /** Plätze beim Weiterspielen um die Plätze (SPEC 5.0), Platz 1 zuerst; mehrere in einer Gruppe = geteilt. null = keine Platzierung. */
  places: number[][] | null;
  /** Frage „Weiterspielen um Platz n oder Spiel beenden?“ steht an. */
  askPlayOn: boolean;
  /** Rückgängig nimmt zuerst diese Ereignisse zurück (Antwort auf die Frage, ggf. samt Weiter). */
  undoFirst: string[];
}

export interface DartInput {
  field: Field | null;
  hit?: boolean;
}

/** Die Regeln eines Modus. Alle Funktionen dürfen den Leg-Stand `ls` und die Aufnahme verändern. */
export interface Rules<LS, TD> {
  gameId: string;
  order: number[];
  format: MatchFormat | null;
  newLeg(legNo: number): LS;
  /** Zusätzliche Angaben einer neuen Aufnahme (z. B. Rest zu Beginn). */
  newTurn(ls: LS, slot: number, round: number): TD;
  /** Fertige Spieler werden übersprungen (z. B. Training: alle Ziele getroffen). */
  isDone?(ls: LS, slot: number): boolean;
  /** Ist dieser Dart für den Modus gültig? Standard: bekanntes, gültiges Feld. */
  acceptsDart?(d: DartInput): boolean;
  /** Wendet einen Dart an. endsTurn = in dieser Aufnahme ist kein weiterer Dart erlaubt. */
  applyDart(ls: LS, turn: Turn<TD>, d: DartInput, dartIndex: number): { scored: number; endsTurn: boolean };
  /** Nach den Darts einer Aufnahme, auch einer unfertigen (z. B. Bust zurücksetzen). */
  afterDarts?(ls: LS, turn: Turn<TD>): void;
  /** Gewinner nach einem Dart (afterTurn = false) bzw. nach einer Aufnahme; null = es geht weiter. */
  winners(ls: LS, at: { afterTurn: boolean; round: number; lastInRound: boolean }): number[] | null;
  /** Fehlwurf zum Auffüllen bei „Weiter“. Standard: daneben. */
  autoMiss?(turn: Turn<TD>): DartInput;
  /**
   * Um die Plätze weiterspielen (SPEC 5.0): Ist dieser Spieler fertig, gemessen an den noch nicht platzierten `remaining`?
   * Nur Modi mit dieser Funktion bieten ab 3 Spielern das Weiterspielen an.
   */
  finishedAt?(ls: LS, slot: number, remaining: number[]): boolean;
}

/**
 * Antworten auf „Weiterspielen oder Spiel beenden?“, wenn der Erste fertig ist (121, Doppelfeld):
 * beantwortet ja/nein, Platz|Aufnahme des Beendens, alle gültigen Antworten.
 */
export function collectEnd(gameId: string, events: readonly GameEvent[]) {
  const voided = voidedIds(events);
  let answered = false;
  let stopAt: string | null = null;
  const ids: string[] = [];
  for (const e of events) {
    if (e.type !== 'game.decision' || voided.has(e.id) || e.payload.gameId !== gameId || e.payload.kind !== 'finishEnd') continue;
    answered = true;
    ids.push(e.id);
    if (e.payload.end) stopAt ??= `${e.payload.slot}|${e.payload.turnIndex}`;
  }
  return { answered, stopAt, ids };
}

/** Antwort auf „Weiterspielen oder Spiel beenden?“ vor der Aufnahme, die gerade dran ist. */
export function decideEnd<LS, TD>(state: CoreState<LS, TD>, end: boolean): NewEvent[] {
  const pos = state.next;
  if (!pos) return [];
  return [{ type: 'game.decision', payload: { gameId: state.gameId, slot: pos.slot, turnIndex: pos.turnIndex, kind: 'finishEnd', end } }];
}

/** Ab so vielen Spielern wird nach dem Sieg gefragt, ob um die weiteren Plätze weitergespielt wird. */
export const PLAY_ON_MIN_PLAYERS = 3;

const defaultAccepts = (d: DartInput) => d.field !== null && isValidField(d.field);

type Rank = [leg: number, turnIndex: number, orderIndex: number];

export function legOrder(order: number[], leg: number): number[] {
  const k = (leg - 1) % order.length;
  return [...order.slice(k), ...order.slice(0, k)];
}

function compareRank(a: Rank, b: Rank): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

const key = (leg: number, slot: number, turnIndex: number) => `${leg}|${slot}|${turnIndex}`;

type DartEvent = GameEvent & { type: 'dart.thrown' };
type ConfirmEvent = GameEvent & { type: 'turn.confirmed' };

export function computeCore<LS, TD>(rules: Rules<LS, TD>, events: readonly GameEvent[]): CoreState<LS, TD> {
  const { order, gameId, format } = rules;
  const accepts = rules.acceptsDart ?? defaultAccepts;
  const voided = voidedIds(events);
  const ignored: CoreState<LS, TD>['ignored'] = [];

  // 1. Darts und Bestätigungen nach Position einsortieren.
  const darts = new Map<string, Map<number, DartEvent>>();
  const confirms = new Map<string, ConfirmEvent>();
  let maxRank: Rank | null = null;
  const noteRank = (leg: number, slot: number, turnIndex: number) => {
    const idx = legOrder(order, leg).indexOf(slot);
    if (idx < 0) return;
    const r: Rank = [leg, turnIndex, idx];
    if (!maxRank || compareRank(r, maxRank) > 0) maxRank = r;
  };
  /** Antworten auf „Weiterspielen um die Plätze?“ je Zahl schon platzierter Spieler (erste gültige zählt). */
  const playOn = new Map<number, { end: boolean; id: string }>();
  const position = new Map<string, number>();

  for (const [i, e] of events.entries()) {
    position.set(e.id, i);
    if (voided.has(e.id)) continue;
    if (e.type === 'game.decision') {
      const p = e.payload;
      if (p.gameId === gameId && p.kind === 'playOn' && !playOn.has(p.placed)) playOn.set(p.placed, { end: p.end, id: e.id });
    } else if (e.type === 'dart.thrown') {
      const p = e.payload;
      if (p.gameId !== gameId) continue;
      if (!accepts({ field: p.field, hit: p.hit }) || p.dartIndex < 1 || p.dartIndex > 3 || !order.includes(p.slot)) {
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
      if (p.gameId !== gameId) continue;
      confirms.set(key(p.leg, p.slot, p.turnIndex), e);
      noteRank(p.leg, p.slot, p.turnIndex);
    }
  }

  const used = new Set<string>();
  const zero = () => Object.fromEntries(order.map((s) => [s, 0]));
  const state: CoreState<LS, TD> = {
    gameId,
    format,
    order,
    legs: [],
    legsWon: zero(),
    legsWonInSet: zero(),
    setsWon: zero(),
    finished: false,
    matchWinners: null,
    matchWinner: null,
    next: null,
    currentTurn: null,
    awaitingConfirm: false,
    ignored,
    actions: [],
    places: null,
    askPlayOn: false,
    undoFirst: [],
  };

  // Um die Plätze weiterspielen (SPEC 5.0)
  const canPlayOn = !!rules.finishedAt && order.length >= PLAY_ON_MIN_PLAYERS;
  const placed = new Set<number>();
  /** Das letzte Leg läuft nach dem Sieg weiter, um die Plätze. */
  let placing = false;
  const usedAnswers: string[] = [];
  /** Nach einem neuen Platz: Ist das Spiel vorbei, steht die Frage an oder geht es weiter? */
  const afterPlace = () => {
    const places = state.places!;
    const remaining = order.filter((s) => !placed.has(s));
    placing = false;
    state.finished = true;
    if (remaining.length === 0) return;
    if (remaining.length === 1) {
      places.push(remaining);
      placed.add(remaining[0]);
      return;
    }
    const answer = playOn.get(placed.size);
    if (!answer) {
      state.finished = false;
      state.askPlayOn = true;
      return;
    }
    usedAnswers.push(answer.id);
    if (answer.end) {
      places.push(remaining);
      for (const s of remaining) placed.add(s);
      return;
    }
    state.finished = false;
    placing = true;
  };
  /** Wer ist jetzt neu fertig? Zuerst der Werfer, dann die anderen in Wurfreihenfolge. */
  const checkPlaces = (ls: LS, thrower: number): boolean => {
    let any = false;
    for (const s of [thrower, ...order.filter((x) => x !== thrower)]) {
      if (placed.has(s)) continue;
      const remaining = order.filter((x) => !placed.has(x));
      if (rules.finishedAt!(ls, s, remaining)) {
        state.places!.push([s]);
        placed.add(s);
        any = true;
      }
    }
    return any;
  };

  /** Ein Leg ist entschieden: Legs und Sets zählen, prüfen, ob das Spiel vorbei ist. */
  const decideLeg = (leg: Leg<LS, TD>, winners: number[]) => {
    leg.winners = winners;
    leg.winner = winners.length === 1 ? winners[0] : null;
    if (!format) {
      state.finished = true;
      state.matchWinners = winners;
      state.matchWinner = leg.winner;
      startPlaces();
      return;
    }
    const w = leg.winner;
    if (w === null) return; // Gleichstand gibt es nur ohne Legs
    state.legsWon[w]++;
    state.legsWonInSet[w]++;
    if (format.sets) {
      if (state.legsWonInSet[w] >= winsNeeded(format.legs)) {
        state.setsWon[w]++;
        if (state.setsWon[w] >= winsNeeded(format.sets)) state.finished = true;
      }
    } else if (state.legsWon[w] >= winsNeeded(format.legs)) {
      state.finished = true;
    }
    if (state.finished) {
      state.matchWinners = [w];
      state.matchWinner = w;
      startPlaces();
    }
  };
  /** Sieger steht fest: ab 3 Spielern beginnt die Platzierung. */
  const startPlaces = () => {
    if (!canPlayOn || state.matchWinner === null) return;
    state.places = [[state.matchWinner]];
    placed.add(state.matchWinner);
    afterPlace();
  };

  // 2. Legs der Reihe nach durchspielen.
  let setNo = 1;
  replay: for (let legNo = 1; ; legNo++) {
    const lo = legOrder(order, legNo);
    const ls = rules.newLeg(legNo);
    const leg: Leg<LS, TD> = { leg: legNo, set: setNo, order: lo, turns: [], winners: null, winner: null, state: ls };
    state.legs.push(leg);

    for (let round = 1; ; round++) {
      let playedThisRound = 0;
      const active = lo.filter((s) => !placed.has(s) && !rules.isDone?.(ls, s));
      for (let oi = 0; oi < lo.length; oi++) {
        const slot = lo[oi];
        if (placed.has(slot) || rules.isDone?.(ls, slot)) continue;
        playedThisRound++;
        const k = key(legNo, slot, round);
        const turnDarts = darts.get(k);
        const confirm = confirms.get(k);
        const hasLater = maxRank !== null && compareRank(maxRank, [legNo, round, oi]) > 0;
        const turn = {
          leg: legNo,
          set: setNo,
          slot,
          turnIndex: round,
          darts: [],
          ended: false,
          complete: false,
          confirmed: false,
          ...rules.newTurn(ls, slot, round),
        } as Turn<TD>;

        // Die Regeln haben den Spieler vor seiner Aufnahme fertig gemacht (121: letzte Zahl übersprungen):
        // Es gibt keine Aufnahme; vielleicht steht jetzt aber der Sieger fest.
        if (rules.isDone?.(ls, slot)) {
          const w = rules.winners(ls, { afterTurn: true, round, lastInRound: active.indexOf(slot) === active.length - 1 });
          if (w) {
            decideLeg(leg, w);
            if (state.finished) break replay;
            continue replay;
          }
          continue;
        }

        if (!turnDarts && !confirm) {
          // Lücke: Diese Aufnahme fehlt, spätere existieren. Alles Spätere ist nicht nachvollziehbar.
          if (hasLater) break replay;
          state.currentTurn = turn;
          state.next = { leg: legNo, set: setNo, slot, turnIndex: round, dartIndex: 1 };
          break replay;
        }

        // Darts der Aufnahme anwenden
        let legDecided = false;
        if (turnDarts) {
          for (const idx of [...turnDarts.keys()].sort((a, b) => a - b)) {
            const e = turnDarts.get(idx)!;
            if (turn.ended) {
              state.ignored.push({ id: e.id, reason: 'nach Ende der Aufnahme' });
              continue;
            }
            used.add(e.id);
            const input: DartInput = { field: e.payload.field, hit: e.payload.hit };
            const { scored, endsTurn } = rules.applyDart(ls, turn, input, idx);
            turn.darts.push({
              id: e.id,
              dartIndex: idx,
              field: e.payload.field ?? MISS,
              known: e.payload.field !== null,
              ...(e.payload.hit !== undefined ? { hit: e.payload.hit } : {}),
              scored,
              input: e.payload.input,
            });
            state.actions.push({ kind: 'dart', id: e.id, turn });
            if (endsTurn) turn.ended = true;
            if (placing) {
              // Um die Plätze: Wer fertig ist, bekommt den nächsten Platz; der Werfer hört dann auf.
              if (checkPlaces(ls, slot)) {
                if (placed.has(slot)) turn.ended = true;
                afterPlace();
                if (!placing) {
                  turn.ended = true;
                  legDecided = true;
                }
              }
              continue;
            }
            const w = rules.winners(ls, { afterTurn: false, round, lastInRound: false });
            if (w) {
              turn.ended = true;
              decideLeg(leg, w);
              legDecided = true;
            }
          }
        }
        rules.afterDarts?.(ls, turn);
        if (confirm) {
          turn.confirmId = confirm.id;
          used.add(confirm.id);
        }
        const maxIndex = turn.darts.length ? turn.darts[turn.darts.length - 1].dartIndex : 0;
        turn.complete = turn.ended || maxIndex >= 3 || !!confirm || hasLater;
        turn.confirmed = !!confirm || hasLater;
        leg.turns.push(turn);
        if (confirm) state.actions.push({ kind: 'confirm', id: confirm.id, turn });

        if (turn.complete && !legDecided && placing) {
          // Manche Modi stehen erst nach der Aufnahme fest (X01: Rest nach afterDarts)
          if (checkPlaces(ls, slot)) {
            if (placed.has(slot)) turn.ended = true;
            afterPlace();
            if (!placing) legDecided = true;
          }
        } else if (turn.complete && !legDecided) {
          const lastInRound = active.indexOf(slot) === active.length - 1;
          const w = rules.winners(ls, { afterTurn: true, round, lastInRound });
          if (w) {
            turn.ended = true;
            decideLeg(leg, w);
            legDecided = true;
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
        if (legDecided) {
          if (state.finished || state.askPlayOn) {
            state.currentTurn = turn;
            break replay;
          }
          // Um die Plätze weiterspielen: dasselbe Leg läuft weiter
          if (placing) continue;
          if (format?.sets && leg.winner !== null && state.legsWonInSet[leg.winner] >= winsNeeded(format.legs)) {
            setNo++;
            for (const s of order) state.legsWonInSet[s] = 0;
          }
          continue replay;
        }
      }
      // Niemand mehr aktiv, aber kein Gewinner: Durchgang ohne Ergebnis beenden (Schutz vor Endlosschleife).
      if (playedThisRound === 0) {
        decideLeg(leg, []);
        break replay;
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

  // Rückgängig: Kam die letzte Antwort nach der letzten Aktion, wird zuerst sie zurückgenommen,
  // nach „Weiterspielen“ samt dem Weiter davor, damit die Frage sofort wieder erscheint.
  const answer = usedAnswers[usedAnswers.length - 1];
  const last = state.actions[state.actions.length - 1];
  if (answer && (!last || position.get(answer)! > position.get(last.id)!)) {
    state.undoFirst = [answer];
    const end = [...playOn.values()].find((a) => a.id === answer)!.end;
    if (!end && last?.kind === 'confirm') state.undoFirst.push(last.id);
  }
  return state;
}

// ---------- Befehle ----------

function dartEvent(gameId: string, t: TurnBase, dartIndex: number, d: DartInput, input: DartPayload['input'], replaces?: string): NewEvent {
  return {
    type: 'dart.thrown',
    payload: {
      gameId,
      slot: t.slot,
      leg: t.leg,
      set: t.set,
      turnIndex: t.turnIndex,
      dartIndex,
      field: d.field,
      ...(d.hit !== undefined ? { hit: d.hit } : {}),
      input,
      ...(replaces ? { replaces } : {}),
    },
  };
}

/** Trägt einen Dart an der nächsten freien Position ein. null, wenn gerade kein Dart möglich ist. */
export function throwDartCore<LS, TD>(
  state: CoreState<LS, TD>,
  rules: Pick<Rules<LS, TD>, 'acceptsDart'>,
  d: DartInput,
  input: DartPayload['input'],
): NewEvent | null {
  const pos = state.next;
  if (!pos || !(rules.acceptsDart ?? defaultAccepts)(d)) return null;
  return {
    type: 'dart.thrown',
    payload: { gameId: state.gameId, ...pos, field: d.field, ...(d.hit !== undefined ? { hit: d.hit } : {}), input },
  };
}

/** Antwort auf „Weiterspielen um die Plätze?“ (SPEC 5.0). Weiterspielen bestätigt zugleich die letzte Aufnahme. */
export function decidePlayOn<LS, TD>(state: CoreState<LS, TD>, end: boolean): NewEvent[] {
  const t = state.currentTurn;
  if (!state.askPlayOn || !t || !state.places) return [];
  const confirm = end ? [] : confirmTurnCore(state, {});
  return [
    ...confirm,
    {
      type: 'game.decision',
      payload: { gameId: state.gameId, slot: t.slot, turnIndex: t.turnIndex, kind: 'playOn', end, placed: state.places.flat().length },
    },
  ];
}

/** „Weiter“: füllt fehlende Darts als Fehlwurf auf (SPEC 3.4) und bestätigt die Aufnahme. */
export function confirmTurnCore<LS, TD>(state: CoreState<LS, TD>, rules: Pick<Rules<LS, TD>, 'autoMiss'>): NewEvent[] {
  const t = state.currentTurn;
  if (!t || t.confirmed) return [];
  const out: NewEvent[] = [];
  if (!t.ended) {
    const miss = rules.autoMiss?.(t) ?? { field: MISS };
    const maxIndex = t.darts.length ? t.darts[t.darts.length - 1].dartIndex : 0;
    for (let i = maxIndex + 1; i <= 3; i++) out.push(dartEvent(state.gameId, t, i, miss, 'auto'));
  }
  out.push({
    type: 'turn.confirmed',
    payload: { gameId: state.gameId, leg: t.leg, slot: t.slot, turnIndex: t.turnIndex },
  });
  return out;
}

/** Rückgängig: letzter Dart, oder letztes „Weiter“ samt aufgefüllter Darts (SPEC 5.1). */
export function undoCore<LS, TD>(state: CoreState<LS, TD>): NewEvent[] {
  if (state.undoFirst.length) {
    return state.undoFirst.map((targetId) => ({ type: 'event.voided', payload: { gameId: state.gameId, targetId, reason: 'undo' } }));
  }
  const last = state.actions[state.actions.length - 1];
  if (!last) return [];
  const ids = [last.id];
  if (last.kind === 'confirm') {
    for (const d of last.turn.darts) if (d.input === 'auto') ids.push(d.id);
  }
  return ids.map((targetId) => ({ type: 'event.voided', payload: { gameId: state.gameId, targetId, reason: 'undo' } }));
}

export interface EditPlan {
  events: NewEvent[];
  /** Darts, die durch die Änderung keinen Platz mehr haben und verworfen werden (SPEC 5.2). */
  discarded: string[];
  /** Ändert sich der Ausgang der bearbeiteten Aufnahme (z. B. Bust oder Checkout)? */
  outcomeChanged: boolean;
  error?: string;
}

const TMP = 'tmp-';

/**
 * Runde bearbeiten: ersetzt die Darts einer Aufnahme im laufenden Leg.
 * `compute` rechnet den Spielstand für eine Ereignisliste aus, `outcome` beschreibt den Ausgang einer Aufnahme.
 */
export function planEditCore<LS, TD>(
  state: CoreState<LS, TD>,
  rules: Pick<Rules<LS, TD>, 'acceptsDart' | 'autoMiss'>,
  events: readonly GameEvent[],
  target: { leg: number; slot: number; turnIndex: number },
  newDarts: DartInput[],
  compute: (events: readonly GameEvent[]) => CoreState<LS, TD>,
  outcome: (t: Turn<TD>) => string,
): EditPlan {
  const leg = state.legs[state.legs.length - 1];
  const empty: EditPlan = { events: [], discarded: [], outcomeChanged: false };
  if (!leg || leg.leg !== target.leg) return { ...empty, error: 'Nur Aufnahmen im laufenden Leg sind bearbeitbar.' };
  const turn = leg.turns.find((t) => t.slot === target.slot && t.turnIndex === target.turnIndex);
  if (!turn) return { ...empty, error: 'Diese Aufnahme gibt es nicht.' };
  const accepts = rules.acceptsDart ?? defaultAccepts;
  if (newDarts.length > 3 || !newDarts.every(accepts)) return { ...empty, error: 'Höchstens 3 gültige Darts.' };

  const gameId = state.gameId;
  const voidEv = (targetId: string): NewEvent => ({ type: 'event.voided', payload: { gameId, targetId, reason: 'edit' } });
  const same = (v: DartView, d: DartInput) =>
    (d.field === null ? !v.known : v.known && v.field.n === d.field.n && v.field.m === d.field.m) && v.hit === d.hit;

  const out: NewEvent[] = [];
  newDarts.forEach((d, i) => {
    const old = turn.darts[i];
    if (old && old.dartIndex === i + 1 && same(old, d)) return;
    if (old) out.push(voidEv(old.id));
    out.push(dartEvent(gameId, turn, i + 1, d, d.hit !== undefined ? 'hitmiss' : 'board', old?.id));
  });
  for (const old of turn.darts.slice(newDarts.length)) out.push(voidEv(old.id));

  const simulate = (extra: NewEvent[]) =>
    compute([...events, ...extra.map((e, i) => ({ ...e, id: `${TMP}${i}`, ts: 0 }) as GameEvent)]);
  const findTurn = (s: CoreState<LS, TD>) =>
    s.legs.find((l) => l.leg === turn.leg)?.turns.find((x) => x.slot === turn.slot && x.turnIndex === turn.turnIndex);

  // Eine bestätigte Aufnahme mit weniger als 3 Darts wird aufgefüllt (SPEC 3.4).
  let simulated = simulate(out);
  const simTurn = findTurn(simulated);
  if (turn.confirmed && simTurn && !simTurn.ended && simTurn.darts.length < 3) {
    const miss = rules.autoMiss?.(simTurn) ?? { field: MISS };
    for (let i = simTurn.darts.length + 1; i <= 3; i++) out.push(dartEvent(gameId, turn, i, miss, 'auto'));
    simulated = simulate(out);
  }

  const before = new Set(state.ignored.map((i) => i.id));
  const discarded = simulated.ignored.map((i) => i.id).filter((id) => !before.has(id) && !id.startsWith(TMP));
  for (const id of discarded) out.push(voidEv(id));

  const after = findTurn(simulate(out));
  return { events: out, discarded, outcomeChanged: !after || outcome(after) !== outcome(turn) };
}
