// Checkout-Vorschläge nach SPEC 7.1, Gegenprüfung G16–G20 und Eigenschaften aus SPEC 14.3.

import { describe, expect, it } from 'vitest';
import golden from './golden/checkouts-double-out.json';
import { formatCheckout, suggestCheckout, type AdviceLevel } from '../../src/engine/checkout';
import { BULL, points, type Field, type Multiplier } from '../../src/engine/types';
import type { InOut } from '../../src/engine/x01';

const show = (rest: number, darts = 3, out: InOut = 'double', level: AdviceLevel = 'expert') =>
  formatCheckout(suggestCheckout(rest, darts, out, level));

describe('Gegenprüfung', () => {
  it('G16: Rest 170 → T20 T20 Bull', () => {
    expect(show(170)).toBe('T20 T20 DB');
    expect(show(170, 3, 'double', 'novice')).toBe('T20 T20 DB');
  });

  it('G17: 169, 168, 166, 165, 163, 162, 159 → kein Vorschlag', () => {
    for (const rest of [169, 168, 166, 165, 163, 162, 159]) {
      expect(suggestCheckout(rest, 3, 'double', 'expert')).toBeNull();
      expect(suggestCheckout(rest, 3, 'double', 'novice')).toBeNull();
    }
  });

  it('G18: über 170 nie ein Vorschlag bei Double-Out', () => {
    for (let rest = 171; rest <= 501; rest++) expect(suggestCheckout(rest, 3, 'double', 'expert')).toBeNull();
  });

  it('G19: alle anderen Reste 2–170 haben genau einen gültigen Vorschlag', () => {
    const none = new Set([169, 168, 166, 165, 163, 162, 159]);
    for (let rest = 2; rest <= 170; rest++) {
      if (none.has(rest)) continue;
      for (const level of ['expert', 'novice'] as const) {
        const plan = suggestCheckout(rest, 3, 'double', level);
        expect(plan, `Rest ${rest}`).not.toBeNull();
        expect(plan!.reduce((s, f) => s + points(f), 0)).toBe(rest);
        expect(plan![plan!.length - 1].m).toBe(2);
        expect(plan!.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('G20: 1 Dart übrig, Rest 100 → kein Vorschlag', () => {
    expect(suggestCheckout(100, 1, 'double', 'expert')).toBeNull();
  });

  it('Rest 1 bei Double-Out → kein Vorschlag', () => {
    expect(suggestCheckout(1, 3, 'double', 'expert')).toBeNull();
  });

  it('Hilfe „Aus“ zeigt nie etwas', () => {
    expect(suggestCheckout(40, 3, 'double', 'off')).toBeNull();
  });
});

describe('Golden-Liste (von Gianluca gegengelesen)', () => {
  for (const level of ['expert', 'novice'] as const) {
    it(`${level}: jeder Rest 2–170 wie in der Liste`, () => {
      const table = (golden as Record<string, Record<string, string>>)[level];
      const actual: Record<string, string> = {};
      for (let rest = 2; rest <= 170; rest++) actual[rest] = show(rest, 3, 'double', level);
      expect(actual).toEqual(table);
    });
  }
});

describe('Bekannte Profi-Wege (Experte)', () => {
  it.each([
    [167, 'T20 T19 DB'],
    [161, 'T20 T17 DB'],
    [160, 'T20 T20 D20'],
    [100, 'T20 D20'],
    [64, 'T16 D8'],
    [40, 'D20'],
    [32, 'D16'],
  ])('Rest %i → %s', (rest, expected) => {
    expect(show(rest)).toBe(expected);
  });

  it('mit 2 Darts übrig: Rest 100 → T20 D20, Rest 101 → T17 Bull', () => {
    expect(show(100, 2)).toBe('T20 D20');
    expect(show(101, 2)).toBe('T17 DB');
  });
});

// ---------- Eigenschaften (SPEC 14.3), unabhängig nachgerechnet ----------

const ALL: Field[] = [
  ...[1, 2, 3].flatMap((m) => Array.from({ length: 20 }, (_, i) => ({ n: i + 1, m: m as Multiplier }))),
  { n: BULL, m: 1 },
  { n: BULL, m: 2 },
];

function outOk(out: InOut, f: Field): boolean {
  return out === 'single' ? true : out === 'double' ? f.m === 2 : f.m >= 2;
}

/** Einfache Gegenrechnung: Gibt es überhaupt einen Weg mit höchstens `darts` Darts? */
function bruteForce(rest: number, darts: number, out: InOut): boolean {
  const min = out === 'single' ? 1 : 2;
  const finish = (r: number) => ALL.some((f) => points(f) === r && outOk(out, f));
  if (finish(rest)) return true;
  if (darts >= 2 && ALL.some((a) => rest - points(a) >= min && finish(rest - points(a)))) return true;
  if (darts >= 3) {
    for (const a of ALL)
      for (const b of ALL) {
        const r1 = rest - points(a);
        const r2 = r1 - points(b);
        if (r1 >= min && r2 >= min && finish(r2)) return true;
      }
  }
  return false;
}

describe('Eigenschaften für alle Out-Arten und 1–3 Darts', () => {
  for (const out of ['single', 'double', 'master'] as const) {
    for (const darts of [1, 2, 3]) {
      it(`${out}-Out, ${darts} Dart(s), Reste 1–181`, () => {
        for (let rest = 1; rest <= 181; rest++) {
          for (const level of ['expert', 'novice'] as const) {
            const plan = suggestCheckout(rest, darts, out, level);
            const possible = bruteForce(rest, darts, out);
            expect(plan !== null, `${out} ${darts} Rest ${rest} ${level}`).toBe(possible);
            if (!plan) continue;
            expect(plan.reduce((s, f) => s + points(f), 0)).toBe(rest);
            expect(plan.length).toBeLessThanOrEqual(darts);
            expect(outOk(out, plan[plan.length - 1])).toBe(true);
            // kein Bust unterwegs
            let r = rest;
            for (const f of plan.slice(0, -1)) {
              r -= points(f);
              expect(r).toBeGreaterThanOrEqual(out === 'single' ? 1 : 2);
            }
            // immer derselbe Vorschlag
            expect(formatCheckout(suggestCheckout(rest, darts, out, level))).toBe(formatCheckout(plan));
          }
        }
      });
    }
  }

  it('Single-Out und Master-Out: höchster Checkout 180', () => {
    expect(show(180, 3, 'single')).toBe('T20 T20 T20');
    expect(show(180, 3, 'master')).toBe('T20 T20 T20');
    expect(suggestCheckout(181, 3, 'single', 'expert')).toBeNull();
  });
});
