import { describe, expect, it } from 'vitest';
import { DEFAULT_CRICKET } from '../../src/engine/cricket';
import { DEFAULT_DOUBLES } from '../../src/engine/doubles';
import { cricketRules, doublesRules, x01Rules } from '../../src/engine/rules';
import { formatAverage, legNumbers, matchNumbers } from '../../src/engine/stats';
import { X01Game } from './helpers';

describe('X01-Kennzahlen (SPEC 11.2)', () => {
  it('3-Dart-Average = Punkte / Darts × 3, Bust zählt 0 Punkte aber seine Darts', () => {
    const g = X01Game.create({ start: 101 })
      .turn('T20', 'S20', 'S1') // A: 81, Rest 20
      .turn('S1', 'S1', 'S1') // B
      .turn('T20') // A: Bust, 1 Dart
      .turn('S1', 'S1', 'S1') // B
      .turn('D10'); // A: Checkout mit 1 Dart
    const n = legNumbers(g.state.legs[0], 0);
    expect(n.darts).toBe(5);
    expect(n.points).toBe(101);
    expect(n.average).toBeCloseTo((101 / 5) * 3);
    expect(n.highestCheckout).toBe(20);
    expect(formatAverage(n.average)).toBe('60,60');
  });

  it('Match-Kennzahlen über mehrere Legs', () => {
    const g = X01Game.create({ start: 40, legs: { count: 2, kind: 'firstTo' } }).turn('D20').turn('0', '0', '0').turn('D20');
    const a = matchNumbers(g.state.legs, 0);
    expect(a.darts).toBe(2);
    expect(a.points).toBe(80);
    expect(matchNumbers(g.state.legs, 1).average).toBe(0);
  });

  it('ohne Darts kein Average', () => {
    const g = X01Game.create({});
    expect(formatAverage(legNumbers(g.state.legs[0], 0).average)).toBe('—');
  });
});

describe('Regeltext Cricket (SPEC 5.4)', () => {
  it('nennt Zielzahlen, Trefferzahl und die Regel der Variante', () => {
    const std = cricketRules(DEFAULT_CRICKET).join(' ');
    expect(std).toContain('20, 19, 18, 17, 16, 15 und Bull');
    expect(std).toContain('3-mal getroffen');
    expect(std).toContain('mindestens so viele Punkte');
    const ct = cricketRules({ ...DEFAULT_CRICKET, variant: 'cutthroat', closeAt: 1, targets: [20] }).join(' ');
    expect(ct).toContain('Gespielt wird auf 20.');
    expect(ct).toContain('einmal getroffen');
    expect(ct).toContain('höchstens so viele Punkte');
    expect(cricketRules({ ...DEFAULT_CRICKET, legs: { count: 3, kind: 'bestOf' } }).join(' ')).toContain('Best of 3');
  });
});

describe('Regeltext Doppelfeld-Training (SPEC 5.4)', () => {
  it('nennt die gewählten Ziele und ihre Anzahl', () => {
    expect(doublesRules(DEFAULT_DOUBLES).join(' ')).toContain('D1 bis D20 und das Bullseye');
    expect(doublesRules(DEFAULT_DOUBLES).join(' ')).toContain('alle 21 Ziele');
    const few = doublesRules({ ...DEFAULT_DOUBLES, targets: [16, 20] }).join(' ');
    expect(few).toContain('Ziele sind D16 und D20, in zufälliger Reihenfolge.');
    expect(few).not.toContain('Bullseye');
    expect(few).toContain('alle 2 Ziele');
    const fixed = doublesRules({ ...DEFAULT_DOUBLES, targets: [25], mode: { kind: 'fixed', darts: 9 } }).join(' ');
    expect(fixed).toContain('Ziele sind Bullseye. Beim Bull zählt nur das Bullseye.');
    expect(fixed).toContain('Nach 1 × 9 Darts');
  });
});

describe('Regeltext (SPEC 5.4)', () => {
  const base = X01Game.create({}).setup.settings;

  it('passt sich den Einstellungen an', () => {
    expect(x01Rules(base).join(' ')).toContain('Double-Out');
    expect(x01Rules(base).join(' ')).toContain('Jeder Treffer zählt sofort');
    expect(x01Rules({ ...base, inMode: 'double' }).join(' ')).toContain('Double-In');
    expect(x01Rules({ ...base, outMode: 'single' }).join(' ')).not.toContain('genau 1');
    expect(x01Rules({ ...base, startScore: 301 })[0]).toContain('301');
  });

  it('erklärt Legs und Sets', () => {
    expect(x01Rules({ ...base, legs: { count: 5, kind: 'bestOf' } }).join(' ')).toContain('Best of 5: Wer zuerst 3 Legs gewinnt');
    const sets = x01Rules({ ...base, legs: { count: 3, kind: 'firstTo' }, sets: { count: 2, kind: 'firstTo' } }).join(' ');
    expect(sets).toContain('Wer zuerst 3 Legs gewinnt, gewinnt ein Set');
    expect(sets).toContain('Wer zuerst 2 Sets gewinnt, gewinnt das Spiel');
  });
});
