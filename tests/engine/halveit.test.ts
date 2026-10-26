// Halve-It nach SPEC 7.9, Gegenprüfung G48–G51.

import { describe, expect, it } from 'vitest';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import {
  DEFAULT_HALVEIT,
  computeHalveIt,
  confirmHalveItTurn,
  halveScore,
  throwHalveItDart,
  undoHalveIt,
  validateHalveIt,
  type HalveItSettings,
  type HalveItState,
} from '../../src/engine/halveit';
import { BULL, parseField } from '../../src/engine/types';

const A = 0;
const B = 1;

class HalveIt {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: HalveItSettings,
    readonly players = 1,
  ) {}
  static create(patch: Partial<HalveItSettings> = {}, players = 1) {
    return new HalveIt({ ...DEFAULT_HALVEIT, ...patch }, players);
  }
  get state(): HalveItState {
    return computeHalveIt({ gameId: 'h1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwHalveItDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmHalveItTurn(this.state));
  }
}

describe('Halve-It', () => {
  it('Standardfolge und Prüfung der Einstellungen', () => {
    expect(DEFAULT_HALVEIT.targets).toEqual([15, 16, 'D', 17, 18, 'T', 19, 20, BULL]);
    expect(validateHalveIt(DEFAULT_HALVEIT)).toEqual([]);
    expect(validateHalveIt({ targets: [], startPoints: 0 })).toHaveLength(1);
    expect(validateHalveIt({ targets: [21], startPoints: 0 })).toHaveLength(1);
    expect(validateHalveIt({ targets: [20], startPoints: 101 })).toHaveLength(1);
  });

  it('G48: Ziel 15: T15 S15 S20 → 60', () => {
    const g = HalveIt.create().throw('T15', 'S15', 'S20');
    expect(g.state.points[A]).toBe(60);
  });

  it('G49: kein Treffer → halbiert und abgerundet', () => {
    const g = HalveIt.create({ startPoints: 61, targets: [16] }).throw('S20', 'T19', '0');
    expect(g.state.points[A]).toBe(30);
    expect(g.state.currentTurn!.halved).toBe(true);
  });

  it('erst nach dem dritten Dart halbiert; „Weiter“ füllt auf; Rückgängig hebt es auf', () => {
    const g = HalveIt.create({ startPoints: 40, targets: [16, 17] }).throw('S20');
    expect(g.state.points[A]).toBe(40);
    g.add(confirmHalveItTurn(g.state));
    expect(g.state.points[A]).toBe(20);
    g.add(undoHalveIt(g.state));
    expect(g.state.points[A]).toBe(40);
  });

  it('G50: beliebiges Double – Bullseye zählt als Double', () => {
    expect(halveScore('D', parseField('D5')) + halveScore('D', parseField('D20')) + halveScore('D', parseField('DB'))).toBe(100);
    expect(halveScore('D', parseField('T20'))).toBe(0);
  });

  it('G51: Bull zählt 25 bzw. 50; beliebiges Triple zählt das getroffene Triple', () => {
    expect(halveScore(BULL, parseField('SB')) + halveScore(BULL, parseField('DB'))).toBe(75);
    expect(halveScore('T', parseField('T7'))).toBe(21);
    expect(halveScore('T', parseField('DB'))).toBe(0);
  });

  it('nach dem letzten Ziel gewinnt, wer die meisten Punkte hat', () => {
    const g = HalveIt.create({ targets: [20, 19] }, 2);
    g.turn('S20').turn('T20').turn('S19').turn('0');
    expect(g.state.finished).toBe(true);
    // A: 20 + 19 = 39; B: 60, dann halbiert → 30
    expect(g.state.points).toEqual({ [A]: 39, [B]: 30 });
    expect(g.state.matchWinners).toEqual([A]);
  });
});
