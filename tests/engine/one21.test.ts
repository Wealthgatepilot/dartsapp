// 121 nach SPEC 7.7, Gegenprüfung G52–G55.

import { describe, expect, it } from 'vitest';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import {
  DEFAULT_ONE21,
  computeOne21,
  confirmOne21Turn,
  throwOne21Dart,
  undoOne21,
  validateOne21,
  type One21Settings,
  type One21State,
} from '../../src/engine/one21';
import { parseField } from '../../src/engine/types';

const A = 0;
const B = 1;

class One21 {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: One21Settings,
    readonly players = 1,
  ) {}
  static create(patch: Partial<One21Settings> = {}, players = 1) {
    return new One21({ ...DEFAULT_ONE21, ...patch }, players);
  }
  get state(): One21State {
    return computeOne21({ gameId: 'o1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwOne21Dart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmOne21Turn(this.state));
  }
}

describe('121', () => {
  it('Einstellungen prüfen', () => {
    expect(validateOne21(DEFAULT_ONE21)).toEqual([]);
    expect(validateOne21({ ...DEFAULT_ONE21, startTarget: 60 })).toHaveLength(1);
    expect(validateOne21({ ...DEFAULT_ONE21, attempts: 0 })).toHaveLength(1);
  });

  it('G52: Bust bei Rest 1 → zurück auf 121, Versuch läuft weiter', () => {
    const g = One21.create().throw('T20', 'T20');
    const t = g.state.currentTurn!;
    expect(t.bust).toBe(true);
    expect(t.darts).toHaveLength(2);
    g.add(confirmOne21Turn(g.state));
    const p = g.state.players[A];
    expect(p.rest).toBe(121);
    expect(p.target).toBe(121);
    expect(p.turnsUsed).toBe(1);
    expect(p.attemptsDone).toBe(0);
  });

  it('G53: T20 T11 D14 → Erfolg, nächstes Ziel 122', () => {
    const g = One21.create().turn('T20', 'T11', 'D14');
    const p = g.state.players[A];
    expect(p.successes).toBe(1);
    expect(p.highest).toBe(121);
    expect(p.target).toBe(122);
    expect(p.rest).toBe(122);
    expect(p.attemptsDone).toBe(1);
  });

  it('Checkout nur mit Double (Double-Out) bzw. Double oder Triple (Master-Out)', () => {
    expect(One21.create({ startTarget: 61 }).throw('S1', 'T20').state.currentTurn!.bust).toBe(true);
    expect(One21.create({ startTarget: 61, outMode: 'master' }).throw('S1', 'T20').state.currentTurn!.checkout).toBe(true);
  });

  it('G54: 3 Aufnahmen ohne Checkout → „−1“ senkt das Ziel, aber nie unter das Startziel', () => {
    const down = One21.create({ startTarget: 121, afterFail: 'down' });
    for (let i = 0; i < 3; i++) down.turn('S1', 'S1', 'S1');
    expect(down.state.players[A].target).toBe(121);
    expect(down.state.players[A].rest).toBe(121);

    const high = One21.create({ startTarget: 124, afterFail: 'down' }).turn('T20', 'T20', 'D2'); // 124 geschafft → 125
    expect(high.state.players[A].target).toBe(125);
    for (let i = 0; i < 3; i++) high.turn('S1', 'S1', 'S1');
    expect(high.state.players[A].target).toBe(124);

    const same = One21.create({ startTarget: 124 }).turn('T20', 'T20', 'D2');
    for (let i = 0; i < 3; i++) same.turn('S1', 'S1', 'S1');
    expect(same.state.players[A].target).toBe(125);
  });

  it('G55: Spielende nach dem letzten Versuch aller, höchstes Ziel gewinnt', () => {
    const g = One21.create({ attempts: 1, dartsPerAttempt: 3 }, 2);
    g.turn('T20', 'T11', 'D14'); // A checkt 121
    expect(g.state.finished).toBe(false);
    g.throw('S1', 'S1', 'S1'); // B nicht – nach dem dritten Dart ist Schluss, ohne Weiter
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
    g.add(undoOne21(g.state));
    expect(g.state.finished).toBe(false);
    expect(g.state.players[B].attemptsDone).toBe(0);
  });

  it('Spieler wechseln je Aufnahme; ein Versuch mit 9 Darts dauert 3 eigene Aufnahmen', () => {
    const g = One21.create({}, 2);
    g.turn('S1', 'S1', 'S1');
    expect(g.state.next?.slot).toBe(B);
    g.turn('S1', 'S1', 'S1').turn('S1', 'S1', 'S1');
    expect(g.state.players[A].rest).toBe(115);
    expect(g.state.players[A].turnsUsed).toBe(2);
  });
});
