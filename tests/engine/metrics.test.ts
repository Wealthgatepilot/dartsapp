// Kennzahlen nach SPEC 11 und 12, jeweils an einem von Hand nachgerechneten Beispiel.

import { describe, expect, it } from 'vitest';
import { computeCricket, confirmCricketTurn, throwCricketDart, DEFAULT_CRICKET } from '../../src/engine/cricket';
import type { AppEvent, GameEvent, NewAppEvent, NewEvent } from '../../src/engine/events';
import { cricketLegMetrics, doubleTarget, shanghaiMetrics, x01LegMetrics } from '../../src/engine/metrics';
import {
  METRICS,
  bestRecord,
  compareWithBest,
  deviation,
  doubleRates,
  heatmap,
  legRecords,
  series,
} from '../../src/engine/records';
import { DEFAULT_SHANGHAI, computeShanghai, confirmShanghaiTurn, decideShanghai, throwShanghaiDart } from '../../src/engine/shanghai';
import { parseField } from '../../src/engine/types';
import { X01Game } from './helpers';

const A = 0;
const B = 1;

/**
 * Beispiel-Leg 501 Double-Out (Spieler A), B wirft nur daneben:
 *  1. T20 T20 T20       = 180  → Rest 321
 *  2. T20 T19 S20       = 137  → Rest 184
 *  3. T20 S1 T20        = 121  → Rest 63
 *  4. S13 S10 S10       =  33  → Rest 30   (Versuch auf Bull bei Rest 50 verfehlt, auf D20 bei Rest 40 verfehlt)
 *  5. S10 D10           =  30  → Checkout  (Versuch D15 bei Rest 30 verfehlt, D10 bei Rest 20 getroffen)
 */
function exampleLeg(gameId = 'g1') {
  const g = X01Game.create({});
  (g.setup as { gameId: string }).gameId = gameId;
  const miss = () => g.turn('0', '0', '0');
  g.turn('T20', 'T20', 'T20');
  miss();
  g.turn('T20', 'T19', 'S20');
  miss();
  g.turn('T20', 'S1', 'T20');
  miss();
  g.turn('S13', 'S10', 'S10');
  miss();
  g.throw('S10', 'D10');
  return g;
}

describe('X01 je Leg (SPEC 11.2)', () => {
  const g = exampleLeg();
  const leg = g.state.legs[0];
  const m = x01LegMetrics(leg, A, 'double');

  it('Darts, Punkte, 3-Dart-Average = 501 / 14 × 3 = 107,36', () => {
    expect(m.darts).toBe(14);
    expect(m.points).toBe(501);
    expect(m.avg).toBeCloseTo(107.357, 3);
  });

  it('First-9-Average = (180 + 137 + 121) / 9 × 3 = 146', () => {
    expect(m.first9).toBeCloseTo(146, 6);
  });

  it('Double-Versuche: Bull (50), D20 (40), D15 (30) verfehlt, D10 (20) getroffen → 25 %', () => {
    expect(m.doubleAttempts).toBe(4);
    expect(m.checkouts).toBe(1);
    expect(m.doubleRate).toBe(25);
    expect(m.perDouble).toEqual({
      DB: { darts: 1, hits: 0 },
      D20: { darts: 1, hits: 0 },
      D15: { darts: 1, hits: 0 },
      D10: { darts: 1, hits: 1 },
    });
  });

  it('Darts bis zum Finish 14, höchster Checkout 30', () => {
    expect(m.won).toBe(true);
    expect(m.dartsToFinish).toBe(14);
    expect(m.highestCheckout).toBe(30);
  });

  it('Aufnahmen nach Bereichen: eine 180, zwei 120–139', () => {
    expect([m.s80, m.s100, m.s120, m.s140, m.s160, m.s180]).toEqual([0, 0, 2, 0, 0, 1]);
  });

  it('nach den ersten 9 Darts: Average 146, noch kein Double-Versuch, kein Finish', () => {
    const at9 = x01LegMetrics(leg, A, 'double', 9);
    expect(at9.darts).toBe(9);
    expect(at9.avg).toBeCloseTo(146, 6);
    expect(at9.doubleRate).toBeNull();
    expect(at9.dartsToFinish).toBeNull();
  });

  it('Verlierer: nur Fehlwürfe → Average 0, keine Double-Versuche', () => {
    const b = x01LegMetrics(leg, B, 'double');
    expect(b.darts).toBe(12);
    expect(b.avg).toBe(0);
    expect(b.doubleAttempts).toBe(0);
    expect(b.won).toBe(false);
  });

  it('Bust-Aufnahme: Darts zählen, Punkte 0; Double-Versuche zählen mit', () => {
    const bust = X01Game.create({ start: 32 }).throw('S20', 'T20'); // 32 → 12 → Bust
    const b = x01LegMetrics(bust.state.legs[0], A, 'double');
    expect(b.darts).toBe(2);
    expect(b.points).toBe(0);
    expect(b.perDouble).toEqual({ D16: { darts: 1, hits: 0 }, D6: { darts: 1, hits: 0 } });
  });

  it('Double-Versuch nur bei Rest 2–40 gerade oder 50', () => {
    expect([2, 40, 50, 41, 42, 1, 60].map(doubleTarget)).toEqual(['D1', 'D20', 'DB', null, null, null, null]);
  });

  it('Single-Out: keine Double-Versuche', () => {
    expect(x01LegMetrics(leg, A, 'single').doubleAttempts).toBe(0);
  });
});

describe('Cricket je Leg (SPEC 11.3)', () => {
  const evs: GameEvent[] = [];
  let n = 0;
  const setup = { gameId: 'c', settings: DEFAULT_CRICKET, order: [0, 1] };
  const add = (e: NewEvent[]) => e.forEach((x) => evs.push({ ...x, id: `c${++n}`, ts: n } as GameEvent));
  const st = () => computeCricket(setup, evs);
  // A: T20 T20 S19 → 20 zu (3 Marks), 3 Punkte-Marks (+60), 19 ein Mark → 7 zählende Marks in 3 Darts
  for (const f of ['T20', 'T20', 'S19']) add([throwCricketDart(st(), parseField(f))!]);
  add(confirmCricketTurn(st()));

  it('MPR = 7 / 3 × 3 = 7, Punkte 60', () => {
    const m = cricketLegMetrics(st().legs[0], A);
    expect(m.marks).toBe(7);
    expect(m.mpr).toBe(7);
    expect(m.points).toBe(60);
    expect(m.dartsToWin).toBeNull();
  });

  it('nach 1 Dart: 3 Marks → MPR 9, noch 0 Punkte', () => {
    const m = cricketLegMetrics(st().legs[0], A, 1);
    expect(m.mpr).toBe(9);
    expect(m.points).toBe(0);
  });
});

describe('Shanghai (SPEC 11.4)', () => {
  const evs: GameEvent[] = [];
  let n = 0;
  const setup = { gameId: 's', settings: { ...DEFAULT_SHANGHAI, rounds: 2 }, order: [0] };
  const add = (e: NewEvent[]) => e.forEach((x) => evs.push({ ...x, id: `s${++n}`, ts: n } as GameEvent));
  const st = () => computeShanghai(setup, evs);
  // Runde 1 (Ziel 1): S1 D1 T1 → Shanghai, weiterspielen. Runde 2 (Ziel 2): T2 0 0.
  for (const f of ['S1', 'D1', 'T1']) add([throwShanghaiDart(st(), parseField(f))!]);
  add(decideShanghai(st(), false));
  for (const f of ['T2', '0', '0']) add([throwShanghaiDart(st(), parseField(f))!]);
  add(confirmShanghaiTurn(st()));

  it('Marks 6 + 3 = 9 in 6 Darts → MPR 4,5; Endpunkte 6 + 6 = 12', () => {
    const m = shanghaiMetrics(st(), A);
    expect(m.marks).toBe(9);
    expect(m.mpr).toBe(4.5);
    expect(m.points).toBe(12);
  });

  it('schnellstes Shanghai nach 3 Darts auf der 1', () => {
    const m = shanghaiMetrics(st(), A);
    expect(m.fastestShanghai).toBe(3);
    expect(m.shanghaiField).toBe(1);
  });
});

// ---------- Langzeitstatistik je Profil ----------

/** Wandelt ein Testspiel in App-Ereignisse mit Profil p1 auf Platz 0 und einem Gast auf Platz 1. */
function asApp(g: X01Game, ts: number): AppEvent[] {
  const gameId = g.setup.gameId;
  const created: NewAppEvent = {
    type: 'game.created',
    payload: {
      gameId,
      mode: 'x01',
      settings: g.setup.settings,
      advice: 'expert',
      participants: [
        { slot: 0, kind: 'profile', profileId: 'p1' },
        { slot: 1, kind: 'guest', guestName: 'Gast' },
      ],
      seed: 1,
    },
  };
  const order: NewAppEvent = { type: 'game.orderDecided', payload: { gameId, order: [0, 1], method: 'asEntered' } };
  return [
    { ...created, id: `${gameId}-c`, ts } as AppEvent,
    { ...order, id: `${gameId}-o`, ts } as AppEvent,
    ...g.events.map((e) => ({ ...e, id: `${gameId}-${e.id}`, ts: ts + e.ts }) as AppEvent),
  ];
}

describe('Langzeitstatistik je Profil (SPEC 11.6)', () => {
  const g1 = exampleLeg('g1');
  // Zweites, schwächeres Leg: 501 nicht beendet, 3 Aufnahmen à 60
  const g2 = X01Game.create({});
  (g2.setup as { gameId: string }).gameId = 'g2';
  for (let i = 0; i < 3; i++) g2.turn('S20', 'S20', 'S20').turn('0', '0', '0');
  const events = [...asApp(g1, 1000), ...asApp(g2, 2000)];
  const records = legRecords(events);

  it('nur Profile bekommen Einträge, Gäste nicht', () => {
    expect(records.map((r) => [r.profileId, r.gameId])).toEqual([
      ['p1', 'g2'],
      ['p1', 'g1'],
    ]);
  });

  it('Vergleichsgruppe nach Startwert, In und Out', () => {
    expect(records[0].group).toBe('x01|501|single|double');
    expect(records[0].groupLabel).toBe('501 · S-In · D-Out');
  });

  it('Verlauf mit gleitendem Durchschnitt', () => {
    const s = series(records, 'avg');
    expect(s.map((p) => Math.round(p.value * 100) / 100)).toEqual([107.36, 60]);
    expect(s[1].moving).toBeCloseTo((107.357 + 60) / 2, 2);
  });

  it('Heatmap zählt Board-Darts je Feld, aufgefüllte Fehlwürfe nicht', () => {
    const h = heatmap(records.filter((r) => r.gameId === 'g1'));
    expect(h.total).toBe(14);
    expect(h.counts).toEqual({ T20: 6, T19: 1, S20: 1, S1: 1, S13: 1, S10: 3, D10: 1 });
  });

  it('Doppelquote je Feld aus X01', () => {
    const d = doubleRates(records);
    expect(d.D10.x01).toEqual({ darts: 1, hits: 1 });
    expect(d.DB.x01).toEqual({ darts: 1, hits: 0 });
    expect(d.D10.all).toEqual({ darts: 1, hits: 1 });
    expect(d.D10.training).toEqual({ darts: 0, hits: 0 });
  });

  it('Rekorde nur aus abgeschlossenen Legs', () => {
    const avg = METRICS.x01.find((m) => m.key === 'avg')!;
    expect(bestRecord(records, avg)?.gameId).toBe('g1');
    // g2 ist nicht beendet und zählt nicht, selbst wenn es besser wäre
    const onlyOpen = records.filter((r) => r.gameId === 'g2');
    expect(bestRecord(onlyOpen, avg)).toBeNull();
  });

  it('Bestleistungs-Vergleich: Endwert und Stand nach gleich vielen Darts (SPEC 12)', () => {
    const c = compareWithBest(events, { profileId: 'p1', gameId: 'g2', slot: 0, leg: 1 })!;
    expect(c.darts).toBe(9);
    const avg = c.rows.find((r) => r.def.key === 'avg')!;
    // Endwert: 60 gegen Rekord 107,36 → −44,1 %
    expect(avg.record?.value).toBeCloseTo(107.357, 2);
    expect(avg.currentDeviation).toBeCloseTo(((60 - 107.357) / 107.357) * 100, 2);
    // Nach 9 Darts: 60 gegen 146 → −58,9 %
    expect(avg.sameDarts?.record).toBeCloseTo(146, 6);
    expect(avg.sameDarts?.deviation).toBeCloseTo(((60 - 146) / 146) * 100, 4);
    // Endwerte-Kennzahlen haben keinen Stand nach gleich vielen Darts
    const finish = c.rows.find((r) => r.def.key === 'dartsToFinish')!;
    expect(finish.sameDarts).toBeNull();
    expect(finish.record?.value).toBe(14);
  });

  it('Doppelquote je Feld: Training und X01 zusammen', () => {
    // Training nur auf D10: Falsch, Falsch, Treffer
    const gameId = 't1';
    const created: AppEvent = {
      id: 't-c',
      type: 'game.created',
      ts: 3000,
      payload: {
        gameId,
        mode: 'doubles',
        settings: { sequence: 'own', mode: { kind: 'untilHit' }, targets: [10] },
        participants: [{ slot: 0, kind: 'profile', profileId: 'p1' }],
        seed: 1,
      },
    };
    const order: AppEvent = { id: 't-o', type: 'game.orderDecided', ts: 3000, payload: { gameId, order: [0], method: 'asEntered' } };
    const dart = (i: number, hit: boolean): AppEvent => ({
      id: `t-d${i}`,
      type: 'dart.thrown',
      ts: 3001 + i,
      payload: { gameId, slot: 0, leg: 1, set: 1, turnIndex: 1, dartIndex: i, field: hit ? { n: 10, m: 2 } : null, hit, input: 'hitmiss' },
    });
    const all = [...events, created, order, dart(1, false), dart(2, false), dart(3, true)];
    const d = doubleRates(legRecords(all));
    expect(d.D10.training).toEqual({ darts: 3, hits: 1 });
    expect(d.D10.x01).toEqual({ darts: 1, hits: 1 });
    expect(d.D10.all).toEqual({ darts: 4, hits: 2 });
    const training = legRecords(all).find((r) => r.mode === 'doubles')!;
    expect(training.values.hitRate).toBeCloseTo(100 / 3, 6);
  });

  it('Abweichung ohne sinnvollen Rekord (0) → keine Angabe', () => {
    expect(deviation(5, 0)).toBeNull();
    expect(deviation(110, 100)).toBeCloseTo(10, 10);
  });
});
