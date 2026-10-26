// Menschliche Schwankungen des Computers (Wunsch Gianluca): Tagesform, Streaks, Druck.

import { describe, expect, it } from 'vitest';
import { effectiveSigma, formFactor, onFinish, pressure, pressureSensitivity } from '../../src/engine/botform';

const calm = { checkoutDart: true, matchDart: false, opponentOnFinish: false, missedDoubles: 0 };

describe('Tagesform und Streaks', () => {
  it('gleiches Spiel, gleicher Spieler, gleiche Aufnahme → gleiche Form (auch nach Neuladen)', () => {
    expect(formFactor(123, 1, 7)).toBe(formFactor(123, 1, 7));
  });

  it('andere Spiele und andere Spieler haben eine andere Form', () => {
    expect(formFactor(123, 1, 1)).not.toBe(formFactor(124, 1, 1));
    expect(formFactor(123, 0, 1)).not.toBe(formFactor(123, 1, 1));
  });

  it('die Form wandert langsam: benachbarte Aufnahmen ähnlich, im Schnitt um 1', () => {
    let sum = 0;
    let jumps = 0;
    const n = 400;
    for (let seed = 1; seed <= n; seed++) {
      const a = formFactor(seed, 0, 10);
      const b = formFactor(seed, 0, 11);
      sum += Math.log(a);
      jumps += Math.abs(Math.log(b) - Math.log(a));
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.03);
    // von Aufnahme zu Aufnahme meist nur wenige Prozent Unterschied
    expect(jumps / n).toBeLessThan(0.08);
  });
});

describe('Druck', () => {
  it('nur bei Checkout-Darts', () => {
    expect(pressure({ ...calm, checkoutDart: false, matchDart: true })).toBe(0);
    expect(pressure(calm)).toBe(0);
  });

  it('Matchdart, Gegner auf Finish und verpasste Doubles erhöhen den Druck, höchstens 1', () => {
    expect(pressure({ ...calm, matchDart: true })).toBeCloseTo(0.5);
    expect(pressure({ ...calm, opponentOnFinish: true })).toBeCloseTo(0.3);
    expect(pressure({ ...calm, missedDoubles: 2 })).toBeCloseTo(0.2);
    expect(pressure({ ...calm, matchDart: true, opponentOnFinish: true, missedDoubles: 9 })).toBe(1);
  });

  it('schwache Stufen sind empfindlicher als starke', () => {
    expect(pressureSensitivity(1)).toBeCloseTo(0.4);
    expect(pressureSensitivity(10)).toBeCloseTo(0.13);
    const full = { ...calm, matchDart: true, opponentOnFinish: true, missedDoubles: 4 };
    expect(effectiveSigma(10, 1, 1, full)).toBeCloseTo(14);
    expect(effectiveSigma(10, 10, 1, full)).toBeCloseTo(11.3);
    expect(effectiveSigma(10, 5, 1.1, null)).toBeCloseTo(11);
  });

  it('Gegner auf Finish: Rest mit 3 Darts checkbar', () => {
    expect(onFinish(170)).toBe(true);
    expect(onFinish(169)).toBe(false);
    expect(onFinish(171)).toBe(false);
    expect(onFinish(2)).toBe(true);
  });
});
