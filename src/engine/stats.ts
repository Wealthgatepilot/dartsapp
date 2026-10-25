// Einfache X01-Kennzahlen für Leg- und Match-Ende (SPEC 11.2). Die volle Statistik folgt in Phase 2.

import type { Leg, Turn } from './x01';

export interface X01Numbers {
  /** Geworfene Darts, inklusive Bust-Darts und Darts vor dem Double-In. */
  darts: number;
  /** Gezählte Punkte: Summe (Start − Ende) je Aufnahme; Bust-Aufnahmen zählen 0. */
  points: number;
  /** 3-Dart-Average = Punkte / Darts × 3; null ohne Darts. */
  average: number | null;
  /** Höchster Checkout: Rest zu Beginn der Aufnahme, in der gecheckt wurde. */
  highestCheckout: number | null;
}

export function turnScore(t: Turn): number {
  return t.startRemaining - t.endRemaining;
}

export function numbersOf(turns: readonly Turn[]): X01Numbers {
  let darts = 0;
  let points = 0;
  let highestCheckout: number | null = null;
  for (const t of turns) {
    darts += t.darts.length;
    points += turnScore(t);
    if (t.checkout) highestCheckout = Math.max(highestCheckout ?? 0, t.startRemaining);
  }
  return { darts, points, average: darts ? (points / darts) * 3 : null, highestCheckout };
}

export function legNumbers(leg: Leg, slot: number): X01Numbers {
  return numbersOf(leg.turns.filter((t) => t.slot === slot));
}

export function matchNumbers(legs: readonly Leg[], slot: number): X01Numbers {
  return numbersOf(legs.flatMap((l) => l.turns.filter((t) => t.slot === slot)));
}

/** Average mit zwei Nachkommastellen in deutscher Schreibweise, „—“ ohne Wert. */
export function formatAverage(avg: number | null): string {
  return avg === null ? '—' : avg.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
