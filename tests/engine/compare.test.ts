// Vergleich in der Langzeitstatistik (SPEC 11.7), Gegenprüfung G92–G96.

import { describe, expect, it } from 'vitest';
import { DOUBLE_KEYS, comparePeriods, comparePlayers, doubleFields, duels, fieldRate } from '../../src/engine/compare';
import { DEFAULT_COUNTUP, computeCountUp, confirmCountUpTurn, throwCountUpDart } from '../../src/engine/countup';
import type { AppEvent, NewAppEvent } from '../../src/engine/events';
import { METRICS, legRecords, type LegRecord } from '../../src/engine/records';
import { parseField } from '../../src/engine/types';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function rec(profileId: string, values: LegRecord['values'], opts: Partial<LegRecord> = {}): LegRecord {
  return {
    profileId,
    gameId: `g${Math.random()}`,
    slot: 0,
    mode: 'x01',
    group: 'x01|501|single|double',
    groupLabel: '501 · S-In · D-Out',
    ts: NOW - DAY,
    vsBot: false,
    leg: 1,
    complete: true,
    won: false,
    darts: 15,
    values,
    doubles: {},
    heat: {},
    ...opts,
  };
}

describe('Spieler nebeneinander', () => {
  it('G92: Schnitt, Rekord und Hervorhebung', () => {
    const records = [rec('A', { avg: 50 }), rec('A', { avg: 70 }), rec('B', { avg: 40 })];
    const c = comparePlayers(records, ['A', 'B'], METRICS.x01);
    const avg = c.rows.find((r) => r.def.key === 'avg')!;
    expect(avg.per.A).toMatchObject({ avg: 60, best: 70, count: 2 });
    expect(avg.per.B.avg).toBe(40);
    expect(avg.leaders).toEqual(['A']);
    // Gleichstand: niemand hervorgehoben
    expect(comparePlayers([rec('A', { s180: 0 }), rec('B', { s180: 0 })], ['A', 'B'], METRICS.x01).rows.find((r) => r.def.key === 's180')!.leaders).toEqual([]);
  });

  it('G93: Standardgruppe = die mit den meisten Legs beider zusammen', () => {
    const g301 = { group: 'x01|301|single|double', groupLabel: '301' };
    const records = [rec('A', { avg: 50 }, g301), rec('A', { avg: 50 }, g301), ...[1, 2, 3].map(() => rec('B', { avg: 40 }))];
    const c = comparePlayers(records, ['A', 'B'], METRICS.x01);
    expect(c.group).toBe('x01|501|single|double');
    expect(c.legs.A).toHaveLength(0);
    expect(c.groups.map((g) => g.count)).toEqual([3, 2]);
    expect(comparePlayers(records, ['A', 'B'], METRICS.x01, 'x01|301|single|double').legs.A).toHaveLength(2);
  });

  it('niedriger ist besser: weniger Darts bis zum Finish wird hervorgehoben', () => {
    const records = [rec('A', { dartsToFinish: 18 }), rec('B', { dartsToFinish: 21 })];
    expect(comparePlayers(records, ['A', 'B'], METRICS.x01).rows.find((r) => r.def.key === 'dartsToFinish')!.leaders).toEqual(['A']);
  });
});

describe('Direkter Vergleich', () => {
  /** Ein beendetes Count-Up-Spiel über 1 Runde; `points[i]` = Punkte (als S-Felder) je Spieler. */
  function game(id: string, players: string[], points: number[], ts: number): AppEvent[] {
    const out: AppEvent[] = [];
    let n = 0;
    const add = (e: NewAppEvent) => out.push({ ...e, id: `${id}-${++n}`, ts: ts + n } as AppEvent);
    const participants = players.map((p, slot) => ({ slot, kind: 'profile' as const, profileId: p }));
    add({ type: 'game.created', payload: { gameId: id, mode: 'countup', settings: { ...DEFAULT_COUNTUP, rounds: 1 }, participants, seed: 1 } });
    add({ type: 'game.orderDecided', payload: { gameId: id, order: players.map((_, i) => i), method: 'asEntered' } });
    const setup = { gameId: id, settings: { ...DEFAULT_COUNTUP, rounds: 1 }, order: players.map((_, i) => i) };
    for (const pts of points) {
      const state = () => computeCountUp(setup, out as never);
      add(throwCountUpDart(state(), parseField(`S${pts}`))!);
      for (const e of confirmCountUpTurn(state())) add(e);
    }
    add({ type: 'game.ended', payload: { gameId: id, reason: 'finished' } });
    return out;
  }

  it('G94: Bilanz nur aus Spielen mit beiden', () => {
    const events = [
      ...game('g1', ['A', 'B'], [20, 10], NOW - 5 * DAY),
      ...game('g2', ['A', 'B'], [20, 5], NOW - 4 * DAY),
      ...game('g3', ['A', 'B'], [1, 15], NOW - 3 * DAY),
      ...game('g4', ['A', 'C'], [1, 20], NOW - 2 * DAY),
    ];
    const d = duels(events, legRecords(events), 'A', 'B', 'countup', METRICS.countup);
    expect(d.duels).toHaveLength(3);
    expect([d.winsA, d.winsB, d.draws, d.others]).toEqual([2, 1, 0, 0]);
    expect(d.duels[0].gameId).toBe('g3'); // neuestes zuerst
    expect(d.rows.find((r) => r.def.key === 'points')!.a.avg).toBeCloseTo(41 / 3);
  });

  it('Gleichstand und Sieg eines Dritten', () => {
    const events = [...game('g1', ['A', 'B'], [10, 10], NOW), ...game('g2', ['A', 'B', 'C'], [1, 2, 20], NOW)];
    const d = duels(events, legRecords(events), 'A', 'B', 'countup', METRICS.countup);
    expect([d.winsA, d.winsB, d.draws, d.others]).toEqual([0, 0, 1, 1]);
  });
});

describe('Zeiträume', () => {
  it('G95: letzte 30 Tage gegen die 30 davor', () => {
    const records = [rec('A', { avg: 50 }, { ts: NOW - 40 * DAY }), rec('A', { avg: 60 }, { ts: NOW - 10 * DAY }), rec('A', { avg: 99 }, { ts: NOW - 70 * DAY })];
    const row = comparePeriods(records, METRICS.x01, 30, NOW).find((r) => r.def.key === 'avg')!;
    expect(row.before.avg).toBe(50);
    expect(row.now.avg).toBe(60);
    expect(row.delta).toBe(10);
    expect(row.improved).toBe(true);
  });

  it('G96: weniger Darts bis zum Finish gilt als besser', () => {
    const records = [rec('A', { dartsToFinish: 21 }, { ts: NOW - 40 * DAY }), rec('A', { dartsToFinish: 18 }, { ts: NOW - 10 * DAY })];
    const row = comparePeriods(records, METRICS.x01, 30, NOW).find((r) => r.def.key === 'dartsToFinish')!;
    expect(row.delta).toBe(-3);
    expect(row.improved).toBe(true);
  });

  it('ohne Legs im Zeitraum: „—“ (null)', () => {
    const row = comparePeriods([rec('A', { avg: 60 }, { ts: NOW - 10 * DAY })], METRICS.x01, 30, NOW).find((r) => r.def.key === 'avg')!;
    expect(row.before.avg).toBeNull();
    expect(row.delta).toBeNull();
    expect(row.improved).toBeNull();
  });
});

describe('Quote je Doppel (SPEC 11.7, G97)', () => {
  it('G97: Würfe und Treffer je Doppel über mehrere Trainings zusammengezählt', () => {
    const t = (doubles: LegRecord['doubles']) => rec('A', {}, { mode: 'doubles', doubles, doublesSource: 'training' });
    const sum = doubleFields([t({ D16: { darts: 4, hits: 1 }, D20: { darts: 2, hits: 1 } }), t({ D16: { darts: 4, hits: 3 } })]);
    expect(sum.D16).toEqual({ darts: 8, hits: 4 });
    expect(fieldRate(sum.D16)).toBe(50);
    expect(fieldRate(sum.D1)).toBeNull();
    expect(DOUBLE_KEYS).toHaveLength(21);
  });
});
