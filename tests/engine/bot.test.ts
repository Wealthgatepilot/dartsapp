// Computergegner nach SPEC 9: Board-Geometrie, Zielwahl, Stärkestufen.

import { describe, expect, it } from 'vitest';
import { BOT_SIGMA, BOT_TARGET_AVERAGE, aimPoint, fieldAt, seededRandom, throwAt, x01Aim } from '../../src/engine/bot';
import { simulateAverage } from '../../src/engine/botsim';
import { fieldLabel, parseField } from '../../src/engine/types';

const at = (x: number, y: number) => fieldLabel(fieldAt({ x, y }));

describe('Board in Millimetern (SPEC Kapitel 1)', () => {
  it('Bull, Ringe und Rand', () => {
    expect(at(0, 0)).toBe('DB');
    expect(at(0, 10)).toBe('SB');
    expect(at(0, 103)).toBe('T20');
    expect(at(0, 166)).toBe('D20');
    expect(at(0, 130)).toBe('S20');
    expect(at(0, 175)).toBe('0');
    expect(at(0, -103)).toBe('T3');
    expect(at(103, 0)).toBe('T6');
    expect(at(-103, 0)).toBe('T11');
  });

  it('die Nachbarn der 20 sind 5 und 1', () => {
    const a = (11 * Math.PI) / 180; // 11° rechts von oben
    expect(at(Math.sin(a) * 130, Math.cos(a) * 130)).toBe('S1');
    expect(at(-Math.sin(a) * 130, Math.cos(a) * 130)).toBe('S5');
  });

  it('der Zielpunkt eines Feldes liegt in diesem Feld', () => {
    for (const f of ['T20', 'D16', 'S7', 'T19', 'D1', 'SB', 'DB']) expect(fieldLabel(fieldAt(aimPoint(parseField(f))))).toBe(f);
  });

  it('ohne Streuung trifft der Computer genau', () => {
    expect(fieldLabel(throwAt(parseField('T20'), 0, seededRandom(1)))).toBe('T20');
  });
});

describe('Zielwahl X01', () => {
  it('T20 bei großem Rest, sonst der Experten-Checkout', () => {
    expect(fieldLabel(x01Aim(501, 3, 'double', null))).toBe('T20');
    expect(fieldLabel(x01Aim(170, 3, 'double', null))).toBe('T20');
    expect(fieldLabel(x01Aim(40, 1, 'double', null))).toBe('D20');
    expect(fieldLabel(x01Aim(50, 1, 'double', null))).toBe('DB');
  });

  it('ohne Checkout mit den übrigen Darts: einen checkbaren Rest stellen, nie absichtlich überwerfen', () => {
    // 100 mit 1 Dart: kein Checkout → Feld, das einen 2-Dart-Rest lässt
    const f = x01Aim(100, 1, 'double', null);
    expect(100 - f.n * f.m).toBeGreaterThanOrEqual(2);
    // 3 mit Double-Out: S1 stellt 2 (D1)
    expect(fieldLabel(x01Aim(3, 3, 'double', null))).toBe('S1');
  });

  it('Double-In: erst auf ein Double', () => {
    expect(fieldLabel(x01Aim(501, 3, 'double', 'double'))).toBe('D20');
  });
});

describe('Stärkestufen (SPEC 9)', () => {
  it('stärkere Stufe = kleinere Streuung', () => {
    for (let l = 2; l <= 10; l++) expect(BOT_SIGMA[l]).toBeLessThan(BOT_SIGMA[l - 1]);
  });

  it('Average je Stufe im Rahmen ±2 (2 000 Legs, fester Zufall)', () => {
    for (const level of [1, 5, 10]) {
      const avg = simulateAverage(BOT_SIGMA[level], 2000, seededRandom(42 + level));
      expect(Math.abs(avg - BOT_TARGET_AVERAGE[level])).toBeLessThanOrEqual(2);
    }
  });
});
