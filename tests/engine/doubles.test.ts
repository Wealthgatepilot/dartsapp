// Doppelfeld-Training nach SPEC 7.4, Gegenprüfung G34–G35.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOUBLES,
  computeDoubles,
  confirmDoublesTurn,
  currentTarget,
  decideDoublesEnd,
  quote,
  sequenceFor,
  shuffledTargets,
  throwDoublesDart,
  undoDoubles,
  validateDoubles,
  type DoublesSettings,
  type DoublesState,
} from '../../src/engine/doubles';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import { fieldLabel } from '../../src/engine/types';

const A = 0;
const B = 1;

class Training {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: DoublesSettings,
    readonly players = 2,
    readonly seed = 42,
  ) {}
  static create(patch: Partial<DoublesSettings> = {}, players = 2) {
    return new Training({ ...DEFAULT_DOUBLES, ...patch }, players);
  }
  get state(): DoublesState {
    return computeDoubles(
      { gameId: 't1', settings: this.settings, order: [...Array(this.players).keys()], seed: this.seed },
      this.events,
    );
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  /** „x“ = Treffer, „o“ = Falsch, z. B. throw('oox'). */
  throw(code: string) {
    for (const c of code) {
      const ev = throwDoublesDart(this.state, c === 'x');
      if (!ev) throw new Error('Dart nicht möglich');
      this.add([ev]);
    }
    return this;
  }
  turn(code: string) {
    return this.throw(code).add(confirmDoublesTurn(this.state));
  }
  target(slot: number) {
    return fieldLabel(currentTarget(this.state.players[slot])!);
  }
}

describe('Zielfolge', () => {
  it('enthält D1–D20 und Bullseye genau einmal, gemischt', () => {
    const seq = shuffledTargets(42).map(fieldLabel);
    expect(seq).toHaveLength(21);
    expect(new Set(seq)).toEqual(new Set([...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'DB']));
    expect(seq).not.toEqual([...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'DB']);
  });

  it('gleicher Zufallswert → gleiche Folge (nachrechenbar)', () => {
    expect(shuffledTargets(7).map(fieldLabel)).toEqual(shuffledTargets(7).map(fieldLabel));
    expect(shuffledTargets(7).map(fieldLabel)).not.toEqual(shuffledTargets(8).map(fieldLabel));
  });

  it('gemeinsame Folge für alle oder eigene je Spieler', () => {
    const base = { gameId: 't', order: [0, 1], seed: 5 };
    const shared = { ...base, settings: { ...DEFAULT_DOUBLES, sequence: 'shared' as const } };
    const own = { ...base, settings: { ...DEFAULT_DOUBLES, sequence: 'own' as const } };
    expect(sequenceFor(shared, 0).map(fieldLabel)).toEqual(sequenceFor(shared, 1).map(fieldLabel));
    expect(sequenceFor(own, 0).map(fieldLabel)).not.toEqual(sequenceFor(own, 1).map(fieldLabel));
  });
});

describe('Freie Zielwahl', () => {
  it('nur die gewählten Ziele, gemischt; fertig nach allen gewählten', () => {
    const g = Training.create({ targets: [16, 20, 25] }, 1);
    const seq = g.state.players[A].sequence.map(fieldLabel);
    expect(new Set(seq)).toEqual(new Set(['D16', 'D20', 'DB']));
    g.throw('xxx');
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinner).toBe(A);
  });

  it('ältere Spiele ohne Zielauswahl: alle 21 Ziele, gleiche Zufallsfolge wie vorher', () => {
    const base = { gameId: 't', order: [0], seed: 99 };
    const old = sequenceFor({ ...base, settings: { sequence: 'own', mode: { kind: 'untilHit' } } }, 0).map(fieldLabel);
    const all = sequenceFor({ ...base, settings: DEFAULT_DOUBLES }, 0).map(fieldLabel);
    expect(old).toHaveLength(21);
    expect(all).toEqual(old);
    expect(old).toEqual(shuffledTargets(99 + 7919).map(fieldLabel));
  });

  it('mindestens ein Ziel', () => {
    expect(validateDoubles({ ...DEFAULT_DOUBLES, targets: [] })).toHaveLength(1);
  });
});

describe('Bis zum Treffer', () => {
  it('Falsch: Ziel bleibt; Treffer: nächstes Ziel', () => {
    const g = Training.create({}, 1);
    const first = g.target(A);
    g.throw('oo');
    expect(g.target(A)).toBe(first);
    g.throw('x');
    expect(g.target(A)).not.toBe(first);
    expect(g.state.players[A].stats[first]).toEqual({ darts: 3, hits: 1 });
  });

  it('G35: Treffer mit Dart 1 → Dart 2 geht schon auf das nächste Ziel', () => {
    const g = Training.create({}, 1);
    const seq = g.state.players[A].sequence.map(fieldLabel);
    g.throw('xo');
    expect(g.state.players[A].stats[seq[0]]).toEqual({ darts: 1, hits: 1 });
    expect(g.state.players[A].stats[seq[1]]).toEqual({ darts: 1, hits: 0 });
  });

  it('G34: Ziel Bull heißt Bullseye; ein Treffer wird als DB gespeichert', () => {
    const g = Training.create({}, 1);
    const seq = g.state.players[A].sequence.map(fieldLabel);
    expect(seq).toContain('DB');
    expect(seq).not.toContain('SB');
    // bis zum Bull vorarbeiten
    for (let i = 0; i < seq.indexOf('DB'); i++) {
      g.throw('x');
      if (g.state.awaitingConfirm) g.add(confirmDoublesTurn(g.state));
    }
    expect(g.target(A)).toBe('DB');
    g.throw('x');
    const last = g.events[g.events.length - 1];
    expect(last.type === 'dart.thrown' && last.payload.field).toEqual({ n: 25, m: 2 });
  });

  it('wer alle 21 Ziele hat, ist fertig und wird übersprungen', () => {
    const g = Training.create({});
    for (let r = 0; r < 7; r++) g.turn('xxx').turn('ooo'); // A trifft immer, B nie
    expect(g.state.players[A].index).toBe(21);
    expect(g.state.next).toMatchObject({ slot: B });
    g.turn('ooo');
    expect(g.state.next).toMatchObject({ slot: B }); // A ist fertig, B wirft weiter
  });

  it('Spielende, wenn alle fertig sind; Sieger = wenigste Darts', () => {
    const g = Training.create({});
    for (let r = 0; r < 7; r++) g.turn('xxx').turn(r < 6 ? 'xxx' : 'xxo');
    expect(g.state.finished).toBe(false); // B hat noch ein Ziel offen
    g.throw('x');
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinner).toBe(A); // 21 gegen 23 Darts
  });
});

describe('Feste Zahl Darts pro Feld', () => {
  it('nach n Darts wechselt das Ziel, auch mitten in der Aufnahme', () => {
    const g = Training.create({ mode: { kind: 'fixed', darts: 2 } }, 1);
    const seq = g.state.players[A].sequence.map(fieldLabel);
    g.throw('xox');
    expect(g.state.players[A].stats[seq[0]]).toEqual({ darts: 2, hits: 1 });
    expect(g.state.players[A].stats[seq[1]]).toEqual({ darts: 1, hits: 1 });
  });

  it('Spielende nach 21 × n Darts je Spieler; Sieger = meiste Treffer', () => {
    const g = Training.create({ mode: { kind: 'fixed', darts: 1 } });
    for (let r = 0; r < 7; r++) g.turn('xxo').turn('xoo');
    expect(g.state.finished).toBe(true);
    expect(g.state.players[A]).toMatchObject({ darts: 21, hits: 14 });
    expect(g.state.matchWinner).toBe(A);
  });

  it('Gleichstand = geteilter Platz', () => {
    const g = Training.create({ mode: { kind: 'fixed', darts: 1 } });
    for (let r = 0; r < 7; r++) g.turn('xoo').turn('oxo');
    expect(g.state.matchWinners).toEqual([A, B]);
  });

  it('Einstellung prüfen', () => {
    expect(validateDoubles({ ...DEFAULT_DOUBLES, mode: { kind: 'fixed', darts: 0 } })).toHaveLength(1);
    expect(validateDoubles({ ...DEFAULT_DOUBLES, mode: { kind: 'fixed', darts: 9 } })).toEqual([]);
  });
});

describe('Ablauf', () => {
  it('Weiter nach 1 Dart füllt mit „Falsch“ auf', () => {
    const g = Training.create({}).throw('o');
    g.add(confirmDoublesTurn(g.state));
    expect(g.state.players[A].darts).toBe(3);
    expect(g.state.next).toMatchObject({ slot: B });
  });

  it('Rückgängig nimmt einen Treffer samt Zielwechsel zurück', () => {
    const g = Training.create({}, 1);
    const first = g.target(A);
    g.throw('x');
    g.add(undoDoubles(g.state));
    expect(g.target(A)).toBe(first);
    expect(g.state.players[A].darts).toBe(0);
  });

  it('Quote mit einer Nachkommastelle, „—“ ohne Würfe', () => {
    expect(quote(1, 8)).toBe('12,5 %');
    expect(quote(2, 17)).toBe('11,8 %');
    expect(quote(0, 0)).toBe('—');
  });
});

describe('Erster fertig: weiterspielen oder beenden (SPEC 7.4 Regel 7)', () => {
  it('G85: A fertig → Frage; Beenden → A gewinnt mit mehr Zielen, B behält sein offenes Ziel', () => {
    const g = Training.create({ targets: [16, 20] });
    g.turn('xx'); // A: beide Ziele getroffen, 2 Darts
    expect(g.state.askEnd).toBe(true);
    expect(g.state.finished).toBe(false);
    g.add(decideDoublesEnd(g.state, true));
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
    expect(g.state.players[B].index).toBe(0);
    // Rückgängig nimmt das Beenden zurück
    g.add(undoDoubles(g.state, g.events));
    expect(g.state.finished).toBe(false);
    expect(g.state.askEnd).toBe(true);
  });

  it('Weiterspielen: B spielt zu Ende, die Frage kommt nicht wieder; weniger Darts gewinnt', () => {
    const g = Training.create({ targets: [16, 20] });
    g.turn('xx');
    g.add(decideDoublesEnd(g.state, false));
    expect(g.state.askEnd).toBe(false);
    g.turn('xx'); // B: auch 2 Darts
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A, B]);
  });
});
