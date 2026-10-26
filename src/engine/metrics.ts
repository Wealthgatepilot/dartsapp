// Kennzahlen je Leg bzw. Durchgang und Spieler (SPEC 11.2–11.5).
// Jede Funktion kann auch nur die ersten `limit` Darts auswerten: Das braucht der Vergleich
// „Stand nach gleich vielen Darts“ (SPEC 12).

import type { CountUpState } from './countup';
import type { CricketLeg, CricketTurn } from './cricket';
import type { DoublesState } from './doubles';
import type { ShanghaiState, ShanghaiTurn } from './shanghai';
import { BULL, fieldLabel } from './types';
import type { InOut, Leg as X01Leg, Turn as X01Turn } from './x01';

export type Mode = 'x01' | 'cricket' | 'shanghai' | 'doubles' | 'countup';

/** Würfe und Treffer je Double (Schlüssel D1 … D20, DB). */
export type DoubleTally = Record<string, { darts: number; hits: number }>;

export function addTally(into: DoubleTally, key: string, hit: boolean, darts = 1): void {
  const t = (into[key] ??= { darts: 0, hits: 0 });
  t.darts += darts;
  if (hit) t.hits++;
}

const ratio = (a: number, b: number) => (b ? a / b : null);

// ---------- X01 (SPEC 11.2) ----------

export interface X01LegMetrics {
  darts: number;
  points: number;
  /** 3-Dart-Average = Punkte / Darts × 3 */
  avg: number | null;
  /** Punkte der ersten 9 Darts (bzw. aller, wenn weniger) / Anzahl dieser Darts × 3 */
  first9: number | null;
  doubleAttempts: number;
  checkouts: number;
  /** Checkouts / Double-Versuche × 100 */
  doubleRate: number | null;
  perDouble: DoubleTally;
  /** Nur in gewonnenen Legs: geworfene Darts. */
  dartsToFinish: number | null;
  /** Nur in gewonnenen Legs: Rest zu Beginn der Checkout-Aufnahme. */
  highestCheckout: number | null;
  /** Aufnahmen je Bereich 80–99, 100–119, 120–139, 140–159, 160–179, 180 (getrennt). */
  s80: number;
  s100: number;
  s120: number;
  s140: number;
  s160: number;
  s180: number;
  won: boolean;
}

/** Ist der Rest mit genau einem Dart auf ein Double checkbar? (Double-Versuch, SPEC 11.2) */
export function doubleTarget(rest: number): string | null {
  if (rest === 50) return 'DB';
  if (rest >= 2 && rest <= 40 && rest % 2 === 0) return `D${rest / 2}`;
  return null;
}

export function x01LegMetrics(leg: X01Leg, slot: number, outMode: InOut, limit = Infinity): X01LegMetrics {
  const m: X01LegMetrics = {
    darts: 0,
    points: 0,
    avg: null,
    first9: null,
    doubleAttempts: 0,
    checkouts: 0,
    doubleRate: null,
    perDouble: {},
    dartsToFinish: null,
    highestCheckout: null,
    s80: 0,
    s100: 0,
    s120: 0,
    s140: 0,
    s160: 0,
    s180: 0,
    won: false,
  };
  let f9points = 0;
  let f9darts = 0;
  outer: for (const t of leg.turns.filter((x) => x.slot === slot) as X01Turn[]) {
    let rest = t.startRemaining;
    let isIn = t.startIn;
    let turnPoints = 0;
    for (let i = 0; i < t.darts.length; i++) {
      if (m.darts >= limit) break outer;
      const d = t.darts[i];
      m.darts++;
      const last = i === t.darts.length - 1;
      // Double-Versuch: Rest vor dem Dart ist mit einem Dart auf ein Double checkbar
      const target = outMode === 'single' || !isIn ? null : doubleTarget(rest);
      if (target) {
        const hit = t.checkout && last;
        m.doubleAttempts++;
        if (hit) m.checkouts++;
        addTally(m.perDouble, target, hit);
      }
      // Punkte: Bust-Aufnahmen zählen 0. Der Rest für die Double-Versuche läuft aber mit den geworfenen Punkten mit.
      const pts = t.bust ? 0 : d.scored;
      if (d.scored > 0) isIn = true;
      rest -= d.scored;
      turnPoints += pts;
      m.points += pts;
      if (m.darts <= 9) {
        f9points += pts;
        f9darts++;
      }
      if (last && t.complete) {
        // Aufnahme vollständig: in den Bereich einsortieren
        const s = turnPoints;
        if (s === 180) m.s180++;
        else if (s >= 160) m.s160++;
        else if (s >= 140) m.s140++;
        else if (s >= 120) m.s120++;
        else if (s >= 100) m.s100++;
        else if (s >= 80) m.s80++;
        if (t.checkout) {
          m.won = true;
          m.dartsToFinish = m.darts;
          m.highestCheckout = t.startRemaining;
        }
      }
    }
  }
  m.avg = m.darts ? (m.points / m.darts) * 3 : null;
  m.first9 = f9darts ? (f9points / f9darts) * 3 : null;
  m.doubleRate = m.doubleAttempts ? (m.checkouts / m.doubleAttempts) * 100 : null;
  return m;
}

// ---------- Cricket (SPEC 11.3) ----------

export interface CricketLegMetrics {
  darts: number;
  /** Zählende Marks (schließen oder bringen Punkte). */
  marks: number;
  /** Marks pro 3 Darts */
  mpr: number | null;
  /** Eigene Punkte nach den ausgewerteten Darts (am Leg-Ende = Gesamtpunkte). */
  points: number;
  dartsToWin: number | null;
  won: boolean;
}

export function cricketLegMetrics(leg: CricketLeg, slot: number, limit = Infinity): CricketLegMetrics {
  const m: CricketLegMetrics = { darts: 0, marks: 0, mpr: null, points: 0, dartsToWin: null, won: false };
  outer: for (const t of leg.turns.filter((x) => x.slot === slot) as CricketTurn[]) {
    for (let i = 0; i < t.darts.length; i++) {
      if (m.darts >= limit) break outer;
      m.darts++;
      m.marks += t.darts[i].scored;
      m.points += t.dartPoints[i] ?? 0;
    }
  }
  if (limit === Infinity) {
    m.points = leg.state.points[slot]; // inkl. Punkte, die Gegner gegeben haben (Cut-Throat)
    if (leg.winner === slot) {
      m.won = true;
      m.dartsToWin = m.darts;
    }
  }
  m.mpr = ratio(m.marks * 3, m.darts);
  return m;
}

// ---------- Shanghai (SPEC 11.4) ----------

export interface ShanghaiMetrics {
  darts: number;
  marks: number;
  /** Marks pro 3 Darts, höchstens 9 */
  mpr: number | null;
  points: number;
  /** Darts im Durchgang bis einschließlich des Darts, der das erste Shanghai vollendet. */
  fastestShanghai: number | null;
  shanghaiField: number | null;
}

export function shanghaiMetrics(state: ShanghaiState, slot: number, limit = Infinity): ShanghaiMetrics {
  const m: ShanghaiMetrics = { darts: 0, marks: 0, mpr: null, points: 0, fastestShanghai: null, shanghaiField: null };
  outer: for (const t of state.legs[0].turns.filter((x) => x.slot === slot) as ShanghaiTurn[]) {
    for (let i = 0; i < t.darts.length; i++) {
      if (m.darts >= limit) break outer;
      const d = t.darts[i];
      m.darts++;
      if (d.field.n === t.target && d.field.m > 0) m.marks += d.field.m;
      m.points += d.scored;
      if (t.shanghai && m.fastestShanghai === null && i === t.darts.length - 1 && limit === Infinity) {
        m.fastestShanghai = m.darts;
        m.shanghaiField = t.target;
      }
    }
  }
  m.mpr = ratio(m.marks * 3, m.darts);
  return m;
}

// ---------- Count-Up (SPEC 7.10) ----------

export interface CountUpMetrics {
  darts: number;
  points: number;
  /** 3-Dart-Average = Punkte / Darts × 3 */
  avg: number | null;
}

export function countUpMetrics(state: CountUpState, slot: number, limit = Infinity): CountUpMetrics {
  const m: CountUpMetrics = { darts: 0, points: 0, avg: null };
  outer: for (const t of state.legs[0].turns.filter((x) => x.slot === slot)) {
    for (const d of t.darts) {
      if (m.darts >= limit) break outer;
      m.darts++;
      m.points += d.scored;
    }
  }
  m.avg = ratio(m.points * 3, m.darts);
  return m;
}

// ---------- Doppelfeld-Training (SPEC 11.5) ----------

export interface DoublesMetrics {
  darts: number;
  hits: number;
  /** Treffer / Würfe × 100 */
  hitRate: number | null;
  perField: DoubleTally;
}

export function doublesMetrics(state: DoublesState, slot: number, limit = Infinity): DoublesMetrics {
  const m: DoublesMetrics = { darts: 0, hits: 0, hitRate: null, perField: {} };
  outer: for (const t of state.legs[0].turns.filter((x) => x.slot === slot)) {
    for (const d of t.darts) {
      if (m.darts >= limit) break outer;
      m.darts++;
      if (d.hit) m.hits++;
    }
  }
  if (limit === Infinity) {
    for (const [k, v] of Object.entries(state.players[slot].stats)) m.perField[k] = { ...v };
  }
  m.hitRate = m.darts ? (m.hits / m.darts) * 100 : null;
  return m;
}

// ---------- Heatmap (SPEC 11.6) ----------

/** Feldschlüssel für die Heatmap: S20, D16, T19, SB, DB, 0 (daneben). */
export function heatKey(n: number, m: number): string {
  if (m === 0) return '0';
  return fieldLabel({ n, m: m as 1 | 2 | 3 });
}

export const BULL_KEYS = [heatKey(BULL, 1), heatKey(BULL, 2)];
