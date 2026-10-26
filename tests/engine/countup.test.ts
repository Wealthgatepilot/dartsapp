// Count-Up nach SPEC 7.10, Gegenprüfung G39–G40.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COUNTUP,
  computeCountUp,
  confirmCountUpTurn,
  countUpAverage,
  throwCountUpDart,
  undoCountUp,
  validateCountUp,
  type CountUpSettings,
  type CountUpState,
} from '../../src/engine/countup';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import { parseField } from '../../src/engine/types';

const A = 0;
const B = 1;

class CountUp {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: CountUpSettings,
    readonly players = 2,
  ) {}
  static create(patch: Partial<CountUpSettings> = {}, players = 2) {
    return new CountUp({ ...DEFAULT_COUNTUP, ...patch }, players);
  }
  get state(): CountUpState {
    return computeCountUp({ gameId: 'c1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwCountUpDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmCountUpTurn(this.state));
  }
}

describe('Count-Up', () => {
  it('Rundenzahl 1 bis 50', () => {
    expect(validateCountUp({ rounds: 1 })).toEqual([]);
    expect(validateCountUp({ rounds: 50 })).toEqual([]);
    expect(validateCountUp({ rounds: 0 })).toHaveLength(1);
    expect(validateCountUp({ rounds: 51 })).toHaveLength(1);
  });

  it('G39: Gleichstand nach der letzten Runde → beide gewinnen, erst nach Bs letzter Aufnahme', () => {
    const g = CountUp.create({ rounds: 2 });
    g.turn('T20', 'T20', 'T20').turn('S20', 'S20', 'S20').turn('0', '0', '0');
    expect(g.state.finished).toBe(false);
    g.throw('D20', 'D20', 'D20');
    expect(g.state.finished).toBe(true);
    expect(g.state.points).toEqual({ [A]: 180, [B]: 180 });
    expect(g.state.matchWinners).toEqual([A, B]);
  });

  it('G40: DB T19 Daneben → 107 Punkte, Average 107', () => {
    const g = CountUp.create({ rounds: 1 }, 1).throw('DB', 'T19', '0');
    expect(g.state.points[A]).toBe(107);
    expect(countUpAverage(g.state, A)).toBe(107);
    expect(g.state.matchWinners).toEqual([A]);
  });

  it('meiste Punkte gewinnen, „Weiter“ füllt auf, Rückgängig nimmt beides zurück', () => {
    const g = CountUp.create({ rounds: 1 });
    g.turn('S5').turn('S1', 'S1');
    expect(g.state.matchWinners).toEqual([A]);
    g.add(undoCountUp(g.state));
    expect(g.state.finished).toBe(false);
    expect(g.state.currentTurn!.darts).toHaveLength(2);
  });
});
