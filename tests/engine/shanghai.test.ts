// Shanghai nach SPEC 7.3, Gegenprüfung G31–G33.

import { describe, expect, it } from 'vitest';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import {
  DEFAULT_SHANGHAI,
  computeShanghai,
  confirmShanghaiTurn,
  targetOfRound,
  throwShanghaiDart,
  validateShanghai,
  type ShanghaiSettings,
  type ShanghaiState,
} from '../../src/engine/shanghai';
import { parseField } from '../../src/engine/types';

const A = 0;
const B = 1;

class Shanghai {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: ShanghaiSettings,
    readonly players = 2,
  ) {}
  static create(patch: Partial<ShanghaiSettings> = {}, players = 2) {
    return new Shanghai({ ...DEFAULT_SHANGHAI, ...patch }, players);
  }
  get state(): ShanghaiState {
    return computeShanghai({ gameId: 's1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwShanghaiDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmShanghaiTurn(this.state));
  }
}

describe('Zielfolge', () => {
  it('Startzahl 1: Runde 1 = 1, Runde 20 = 20, Runde 21 = Bull', () => {
    expect(targetOfRound(DEFAULT_SHANGHAI, 1)).toBe(1);
    expect(targetOfRound(DEFAULT_SHANGHAI, 20)).toBe(20);
    expect(targetOfRound(DEFAULT_SHANGHAI, 21)).toBe(25);
  });

  it('Startzahl 7: Runde 1 = 7', () => {
    expect(targetOfRound({ ...DEFAULT_SHANGHAI, startNumber: 7 }, 1)).toBe(7);
  });

  it('Rundenzahl höchstens bis Bull', () => {
    expect(validateShanghai({ ...DEFAULT_SHANGHAI, rounds: 21 })).toEqual([]);
    expect(validateShanghai({ ...DEFAULT_SHANGHAI, rounds: 22 })).toHaveLength(1);
    expect(validateShanghai({ ...DEFAULT_SHANGHAI, startNumber: 20, rounds: 2 })).toEqual([]);
    expect(validateShanghai({ ...DEFAULT_SHANGHAI, startNumber: 20, rounds: 3 })).toHaveLength(1);
  });
});

describe('Punkte und Shanghai', () => {
  it('G31: Runde mit Ziel 7, S7 D7 T7 → Shanghai, bei „beendet“ sofort Sieg', () => {
    const g = Shanghai.create({ startNumber: 7 }).throw('S7', 'D7', 'T7');
    expect(g.state.currentTurn!.shanghai).toBe(true);
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.points[A]).toBe(42);
  });

  it('Shanghai in beliebiger Reihenfolge', () => {
    const g = Shanghai.create({ startNumber: 7 }).throw('T7', 'S7', 'D7');
    expect(g.state.matchWinner).toBe(A);
  });

  it('G32: T7 T7 D7 → kein Shanghai, 21 + 21 + 14 = 56 Punkte', () => {
    const g = Shanghai.create({ startNumber: 7 }).throw('T7', 'T7', 'D7');
    expect(g.state.currentTurn!.shanghai).toBe(false);
    expect(g.state.points[A]).toBe(56);
    expect(g.state.currentTurn!.marks).toBe(8);
  });

  it('G33: Bull-Runde, SB DB DB → 125 Punkte, kein Shanghai möglich', () => {
    const g = Shanghai.create({ startNumber: 20, rounds: 2 }).turn('0', '0', '0').turn('0', '0', '0').throw('SB', 'DB', 'DB');
    expect(g.state.currentTurn!.target).toBe(25);
    expect(g.state.points[A]).toBe(125);
    expect(g.state.currentTurn!.shanghai).toBe(false);
  });

  it('Treffer auf andere Zahlen zählen nichts', () => {
    const g = Shanghai.create({ startNumber: 7 }).throw('T20', 'S8', 'D6');
    expect(g.state.points[A]).toBe(0);
  });

  it('„Shanghai beendet“ aus: wird vermerkt, Spiel läuft weiter', () => {
    const g = Shanghai.create({ startNumber: 7, endOnShanghai: false }).turn('S7', 'D7', 'T7');
    expect(g.state.finished).toBe(false);
    expect(g.state.legs[0].state.shanghaiBy).toEqual([A]);
    expect(g.state.next).toMatchObject({ slot: B, turnIndex: 1 });
  });
});

describe('Spielende', () => {
  it('nach der letzten Runde gewinnen die meisten Punkte', () => {
    const g = Shanghai.create({ rounds: 2 }).turn('S1').turn('T1').turn('S2').turn('0');
    expect(g.state.finished).toBe(true);
    expect(g.state.points).toEqual({ [A]: 3, [B]: 3 });
    expect(g.state.matchWinners).toEqual([A, B]); // Gleichstand: geteilter Sieg
    expect(g.state.matchWinner).toBeNull();
  });

  it('eindeutiger Sieger nach der letzten Runde', () => {
    const g = Shanghai.create({ rounds: 1 }).turn('T1').turn('S1');
    expect(g.state.matchWinner).toBe(A);
  });

  it('vor der letzten Aufnahme der letzten Runde ist noch nichts entschieden', () => {
    const g = Shanghai.create({ rounds: 1 }).turn('T1');
    expect(g.state.finished).toBe(false);
    expect(g.state.next).toMatchObject({ slot: B });
  });
});
