// Cricket nach SPEC 7.2, Gegenprüfung G21–G30.

import { describe, expect, it } from 'vitest';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import {
  DEFAULT_CRICKET,
  computeCricket,
  confirmCricketTurn,
  planCricketEdit,
  throwCricketDart,
  undoCricket,
  validateCricket,
  type CricketSettings,
  type CricketState,
} from '../../src/engine/cricket';
import { parseField } from '../../src/engine/types';

const A = 0;
const B = 1;
const C = 2;

class Cricket {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: CricketSettings,
    readonly players = 2,
  ) {}
  static create(patch: Partial<CricketSettings> = {}, players = 2) {
    return new Cricket({ ...DEFAULT_CRICKET, ...patch }, players);
  }
  get state(): CricketState {
    return computeCricket({ gameId: 'c1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwCricketDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmCricketTurn(this.state));
  }
}

describe('Punkte bei Standard', () => {
  it('G21: A hat 20 zu, B offen → A: T20 bringt +60', () => {
    const g = Cricket.create().turn('T20').turn('0', '0', '0').throw('T20');
    expect(g.state.points[A]).toBe(60);
    expect(g.state.currentTurn!.marks).toBe(3);
  });

  it('G22: A und B haben 20 zu → A: T20 bringt nichts, zählt keine Marks', () => {
    const g = Cricket.create().turn('T20').turn('T20').throw('T20');
    expect(g.state.points[A]).toBe(0);
    expect(g.state.currentTurn!.marks).toBe(0);
    expect(g.state.marks[A][20]).toBe(6);
  });

  it('G23: A hat 1 Mark auf 19, T19 → 2 schließen, 1 überzählig → +19', () => {
    const g = Cricket.create().turn('S19').turn('0', '0', '0').throw('T19');
    expect(g.state.points[A]).toBe(19);
    expect(g.state.marks[A][19]).toBe(4);
  });

  it('Treffer auf Nicht-Zielzahlen zählen 0 Marks', () => {
    const g = Cricket.create().throw('T14', 'S1', '0');
    expect(g.state.currentTurn!.marks).toBe(0);
    expect(g.state.currentTurn!.darts).toHaveLength(3);
  });
});

describe('Cut-Throat', () => {
  it('G24: 3 Spieler, A hat 20 zu, B offen, C zu → A: T20 gibt B +60', () => {
    const g = Cricket.create({ variant: 'cutthroat' }, 3).turn('T20').turn('0', '0', '0').turn('T20').throw('T20');
    expect(g.state.points).toEqual({ [A]: 0, [B]: 60, [C]: 0 });
  });

  it('G25: A hat 20 zu, B und C offen → A: S20 gibt B und C je +20', () => {
    const g = Cricket.create({ variant: 'cutthroat' }, 3).turn('T20').turn('0', '0', '0').turn('0', '0', '0').throw('S20');
    expect(g.state.points).toEqual({ [A]: 0, [B]: 20, [C]: 20 });
  });
});

describe('Siegbedingungen', () => {
  it('G26: Standard – A schließt die letzte Zahl, liegt aber hinten → kein Sieg', () => {
    const g = Cricket.create({ targets: [20, 19] })
      .turn('T20') // A: 20 zu
      .turn('T19', 'T19', 'T19') // B: 19 zu, +114 (A hat 19 offen)
      .throw('T19'); // A: alles zu, 0 gegen 114
    expect(g.state.points).toEqual({ [A]: 0, [B]: 114 });
    expect(g.state.legs[0].winner).toBeNull();
    expect(g.state.next).not.toBeNull();
  });

  it('G27: Standard – A schließt die letzte Zahl bei Punktgleichstand → Sieg A', () => {
    const g = Cricket.create({ targets: [20, 19] })
      .turn('T19', 'S20', 'S20') // A: 19 zu, 20 fast zu
      .turn('T20') // B: 20 zu, 19 noch offen
      .throw('S20'); // A: alles zu, 0 gegen 0
    expect(g.state.points).toEqual({ [A]: 0, [B]: 0 });
    expect(g.state.matchWinner).toBe(A);
  });

  it('G28: Cut-Throat – A schließt die letzte Zahl mit weniger Punkten → Sieg A', () => {
    const g = Cricket.create({ targets: [20, 19], variant: 'cutthroat' })
      .turn('T20', 'S20') // A: 20 zu, B bekommt 20
      .turn('T19', 'S19') // B: 19 zu, A bekommt 19
      .throw('T19'); // A: alles zu, 19 ≤ 20
    expect(g.state.points).toEqual({ [A]: 19, [B]: 20 });
    expect(g.state.matchWinner).toBe(A);
  });

  it('Cut-Throat – mit mehr Punkten kein Sieg', () => {
    const g = Cricket.create({ targets: [20, 19], variant: 'cutthroat' })
      .turn('T20') // A: 20 zu
      .turn('T19', 'T19') // B: 19 zu, A bekommt 57
      .throw('T19'); // A: alles zu, aber 57 > 0
    expect(g.state.matchWinner).toBeNull();
  });

  it('Sieg mitten in der Aufnahme beendet sie, weitere Darts gibt es nicht', () => {
    const g = Cricket.create({ targets: [20] }).throw('T20');
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.next).toBeNull();
    expect(throwCricketDart(g.state, parseField('S1'))).toBeNull();
  });
});

describe('Bull und Trefferzahl', () => {
  it('G29: Bullseye zählt 2 Marks, Single-Bull 1', () => {
    const g = Cricket.create().throw('DB', 'SB');
    expect(g.state.marks[A][25]).toBe(3);
    expect(g.state.currentTurn!.marks).toBe(3);
  });

  it('überzählige Marks auf dem Bull zählen 25 je Mark', () => {
    const g = Cricket.create().turn('DB', 'SB', 'DB');
    expect(g.state.points[A]).toBe(50);
  });

  it('G30: Treffer bis zu 5 – T20 T20 → nach 5 Marks zu, 1 überzählig', () => {
    const g = Cricket.create({ closeAt: 5 }).throw('T20', 'T20');
    expect(g.state.marks[A][20]).toBe(6);
    expect(g.state.points[A]).toBe(20);
  });
});

describe('Ablauf', () => {
  it('Legs: Anwurf wechselt, first to 2', () => {
    const g = Cricket.create({ targets: [20], legs: { count: 2, kind: 'firstTo' } });
    g.turn('T20'); // Leg 1: A gewinnt
    expect(g.state.next).toMatchObject({ leg: 2, slot: B });
    g.turn('T20'); // Leg 2: B gewinnt
    g.turn('T20'); // Leg 3: A
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.legsWon).toEqual({ [A]: 2, [B]: 1 });
  });

  it('Rückgängig nimmt Punkte und Marks zurück', () => {
    const g = Cricket.create().turn('T20').turn('0', '0', '0').throw('T20');
    g.add(undoCricket(g.state));
    expect(g.state.points[A]).toBe(0);
    expect(g.state.marks[A][20]).toBe(3);
  });

  it('Runde bearbeiten: früherer Sieg verwirft spätere Darts', () => {
    const g = Cricket.create({ targets: [20] }).turn('S20', 'S20', '0').turn('0', '0', '0').throw('S5');
    const plan = planCricketEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, ['S20', 'S20', 'S20'].map(parseField));
    expect(plan.outcomeChanged).toBe(true);
    expect(plan.discarded.length).toBeGreaterThanOrEqual(4);
    g.add(plan.events);
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.ignored).toEqual([]);
  });

  it('Einstellungen prüfen', () => {
    expect(validateCricket(DEFAULT_CRICKET)).toEqual([]);
    expect(validateCricket({ ...DEFAULT_CRICKET, targets: [] })).toHaveLength(1);
    expect(validateCricket({ ...DEFAULT_CRICKET, targets: [21] })).toHaveLength(1);
    expect(validateCricket({ ...DEFAULT_CRICKET, closeAt: 0 })).toHaveLength(1);
  });
});
