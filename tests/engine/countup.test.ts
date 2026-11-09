// Count-Up nach SPEC 7.10, Gegenprüfung G39–G40.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COUNTUP,
  computeCountUp,
  confirmCountUpTurn,
  countUpAverage,
  countUpClock,
  timeUpCountUp,
  throwCountUpDart,
  undoCountUp,
  validateCountUp,
  type CountUpSettings,
  type CountUpState,
} from '../../src/engine/countup';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import { countUpMetrics } from '../../src/engine/metrics';
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

describe('Count-Up mit Zeit und Wertung (SPEC 7.10, G86–G91)', () => {
  const timed = (players: number) => CountUp.create({ limit: 'time', minutes: 60 }, players);

  it('G86: Zeit um mitten in der Aufnahme → zu Ende werfen, dann Schluss', () => {
    const g = timed(1).turn('S20', 'S20', 'S20').throw('T20');
    g.add(timeUpCountUp(g.state));
    expect(g.state.timeUp).toBe(true);
    expect(g.state.finished).toBe(false);
    g.throw('T20', 'T20');
    expect(g.state.finished).toBe(true);
    expect(g.state.points[A]).toBe(240);
  });

  it('G87: 2 Spieler, Zeit um während B in Runde 3 wirft → B wirft zu Ende, beide 3 Aufnahmen', () => {
    const g = timed(2).turn('S1').turn('S1').turn('S1').turn('S1').turn('S1');
    expect(g.state.next).toMatchObject({ slot: B, turnIndex: 3, dartIndex: 1 });
    g.add(timeUpCountUp(g.state));
    expect(g.state.finished).toBe(false);
    g.turn('S1');
    expect(g.state.finished).toBe(true);
    expect(g.state.legs[0].turns).toHaveLength(6);
  });

  it('G88: Zeit um, bevor A Runde 3 beginnt → sofort Schluss nach Runde 2', () => {
    const g = timed(2).turn('S5').turn('S1').turn('S5').turn('S1');
    expect(g.state.next).toMatchObject({ slot: A, turnIndex: 3, dartIndex: 1 });
    g.add(timeUpCountUp(g.state));
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
  });

  it('G89: Uhr zählt ab dem ersten Dart und ohne Pausen', () => {
    const min = 60_000;
    const setup = { gameId: 'c1', settings: { ...DEFAULT_COUNTUP, limit: 'time' as const, minutes: 60 }, order: [A] };
    const ev = (id: string, ts: number, type: string, payload: object) => ({ id, ts, type, payload: { gameId: 'c1', ...payload } }) as GameEvent;
    const t0 = 10 * 60 * min;
    const events = [
      ev('d1', t0, 'dart.thrown', { slot: A, leg: 1, set: 1, turnIndex: 1, dartIndex: 1, field: parseField('S1'), input: 'board' }),
      ev('p1', t0 + 20 * min, 'game.decision', { slot: A, turnIndex: 1, kind: 'pause' }),
      ev('r1', t0 + 30 * min, 'game.decision', { slot: A, turnIndex: 1, kind: 'resume' }),
    ];
    const clock = countUpClock(setup, events, t0 + 40 * min);
    expect(clock.elapsedMs).toBe(30 * min);
    expect(clock.remainingMs).toBe(30 * min);
    expect(countUpClock(setup, events.slice(0, 2), t0 + 40 * min)).toMatchObject({ paused: true, elapsedMs: 20 * min });
    expect(countUpClock(setup, [], t0).started).toBe(false);
  });

  it('G90: zusammen → Team-Summe, alle teilen das Ergebnis', () => {
    const g = CountUp.create({ rounds: 1, scoring: 'team' }, 2).turn('T20').turn('T15');
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A, B]);
    expect(g.state.points[A] + g.state.points[B]).toBe(105);
  });

  it('G91: Aufnahmen 85, 100, 180 → je eine in 80+, 100+, 180', () => {
    const g = CountUp.create({ rounds: 3 }, 1).turn('T20', 'S20', 'S5').turn('T20', 'S20', 'S20').turn('T20', 'T20', 'T20');
    expect(countUpMetrics(g.state, A)).toMatchObject({ s80: 1, s100: 1, s120: 0, s180: 1, lastTurn: 180 });
  });

  it('Zeit: Einstellung wird geprüft, ältere Spiele ohne Begrenzung zählen Runden', () => {
    expect(validateCountUp({ ...DEFAULT_COUNTUP, limit: 'time', minutes: 3 })).toHaveLength(1);
    expect(validateCountUp({ ...DEFAULT_COUNTUP, limit: 'time', minutes: 60 })).toEqual([]);
    const old = new CountUp({ rounds: 1 }, 1).turn('S1');
    expect(old.state.finished).toBe(true);
  });
});
