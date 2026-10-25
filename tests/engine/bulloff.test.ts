// Wer beginnt: Ausbullen und Münzwurf (SPEC 6.3, 6.4).

import { describe, expect, it } from 'vitest';
import { coinOrder, computeBulloff, distanceLabel, distanceMm } from '../../src/engine/bulloff';
import type { GameEvent } from '../../src/engine/events';

let n = 0;
const bull = (slot: number, attempt: number, xMm: number, yMm = 0): GameEvent => ({
  id: `b${++n}`,
  type: 'bulloff.throw',
  ts: n,
  payload: { gameId: 'g', slot, attempt, xMm, yMm, distanceMm: distanceMm(xMm, yMm) },
});

describe('Abstand und Anzeige', () => {
  it('Abstand zum Mittelpunkt in mm, eine Nachkommastelle', () => {
    expect(distanceMm(3, 4)).toBe(5);
    expect(distanceMm(14.07, 14.07)).toBe(19.9);
  });

  it('Bullseye bis 6,35 mm, Single-Bull bis 15,9 mm, sonst Abstand', () => {
    expect(distanceLabel(3.2)).toBe('Bullseye · 3,2 mm');
    expect(distanceLabel(6.3)).toBe('Bullseye · 6,3 mm');
    expect(distanceLabel(6.4)).toBe('Single-Bull · 6,4 mm');
    expect(distanceLabel(15.9)).toBe('Single-Bull · 15,9 mm');
    expect(distanceLabel(19.9)).toBe('19,9 mm vom Bull');
  });
});

describe('Rangfolge', () => {
  it('alle werfen in Setup-Reihenfolge, dann aufsteigender Abstand', () => {
    const slots = [0, 1, 2];
    let s = computeBulloff(slots, 'g', []);
    expect(s.next).toEqual({ slot: 0, attempt: 1 });
    const evs = [bull(0, 1, 30), bull(1, 1, 5)];
    s = computeBulloff(slots, 'g', evs);
    expect(s.next).toEqual({ slot: 2, attempt: 1 });
    expect(s.order).toBeNull();
    evs.push(bull(2, 1, 12));
    s = computeBulloff(slots, 'g', evs);
    expect(s.next).toBeNull();
    expect(s.order).toEqual([1, 2, 0]);
  });

  it('auch innerhalb des Bulls zählt der Abstand (Entscheidung Gianluca)', () => {
    const s = computeBulloff([0, 1], 'g', [bull(0, 1, 4), bull(1, 1, 2)]);
    expect(s.order).toEqual([1, 0]);
  });

  it('exakt gleicher Abstand: nur diese werfen erneut, um ihre Plätze', () => {
    const slots = [0, 1, 2];
    const evs = [bull(0, 1, 10), bull(1, 1, 0, 10), bull(2, 1, 3)]; // 0 und 1 beide 10,0 mm
    let s = computeBulloff(slots, 'g', evs);
    expect(s.order).toBeNull();
    expect(s.next).toEqual({ slot: 0, attempt: 2 });
    expect(s.rethrow).toEqual([[0, 1]]);
    evs.push(bull(0, 2, 20), bull(1, 2, 8));
    s = computeBulloff(slots, 'g', evs);
    expect(s.order).toEqual([2, 1, 0]);
  });

  it('erneuter Gleichstand im zweiten Durchgang → dritter Durchgang', () => {
    const evs = [bull(0, 1, 10), bull(1, 1, 10), bull(0, 2, 7), bull(1, 2, 7)];
    let s = computeBulloff([0, 1], 'g', evs);
    expect(s.next).toEqual({ slot: 0, attempt: 3 });
    evs.push(bull(0, 3, 1), bull(1, 3, 2));
    s = computeBulloff([0, 1], 'g', evs);
    expect(s.order).toEqual([0, 1]);
  });

  it('widerrufene Würfe zählen nicht („Erneut werfen“, Rückgängig)', () => {
    const evs = [bull(0, 1, 10), bull(1, 1, 5)];
    evs.push({ id: 'v1', type: 'event.voided', ts: 99, payload: { gameId: 'g', targetId: evs[1].id, reason: 'undo' } });
    const s = computeBulloff([0, 1], 'g', evs);
    expect(s.next).toEqual({ slot: 1, attempt: 1 });
  });

  it('ein Spieler: keine Würfe nötig', () => {
    expect(computeBulloff([0], 'g', []).order).toEqual([0]);
  });
});

describe('Münzwurf', () => {
  it('ergibt eine Reihenfolge aller Spieler', () => {
    const order = coinOrder([0, 1, 2, 3], () => 0.5);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('bei 2 Spielern entscheidet der Zufall, wer beginnt', () => {
    expect(coinOrder([0, 1], () => 0.1)[0]).toBe(1);
    expect(coinOrder([0, 1], () => 0.9)[0]).toBe(0);
  });
});
