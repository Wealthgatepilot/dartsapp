// Checkout-Vorschläge nach SPEC 7.1. Ein Programm probiert alle Wege mit 1–3 Darts durch
// und wählt den Weg mit den niedrigsten „Kosten“. Die Kosten bilden ab, wie Profis bzw. Einsteiger rechnen.

import { qualifiesOut, type InOut } from './x01';
import { BULL, fieldLabel, points, type Field, type Multiplier } from './types';

export type AdviceLevel = 'expert' | 'novice' | 'off';

/** Alle 62 Felder mit Punkten: S1–S20, D1–D20, T1–T20, Single-Bull, Bullseye. */
export const SCORING_FIELDS: readonly Field[] = [
  ...[1, 2, 3].flatMap((m) => Array.from({ length: 20 }, (_, i) => ({ n: i + 1, m: m as Multiplier }))),
  { n: BULL, m: 1 },
  { n: BULL, m: 2 },
];

// ---------- Kosten Experte ----------

const TREBLE_SETUP: Record<number, number> = { 20: 0, 19: 1, 18: 2, 17: 3, 16: 4, 15: 5 };

/** Wie gut eignet sich ein Feld als Vorbereitungs-Dart? (niedriger = besser) */
function expertSetupCost(f: Field): number {
  if (f.n === BULL) return 6; // Single-Bull oder Bullseye zur Vorbereitung: nur wenn nötig
  if (f.m === 3) return TREBLE_SETUP[f.n] ?? 6 + (15 - f.n) * 0.1;
  if (f.m === 2) return 12; // ein Double zur Vorbereitung ist sehr unüblich
  return 2;
}

/** Beliebtheit der Doubles zum Auschecken (SPEC 7.1). Jeder Platz weiter hinten kostet 0,6. */
const DOUBLE_ORDER = [20, 16, 8, 18, 12, 10, 4, 14, 6, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];
const DOUBLE_STEP = 0.6;
/** Das Bullseye ist kleiner als ein Double-Feld und wird nur ungern zum Auschecken stehen gelassen. */
const BULL_FINISH_COST = 7;

function expertFinishCost(f: Field): number {
  if (f.m === 2) return f.n === BULL ? BULL_FINISH_COST : DOUBLE_ORDER.indexOf(f.n) * DOUBLE_STEP;
  if (f.m === 3) return expertSetupCost(f); // Master-Out
  return f.n === BULL ? 1 : 0.5; // Single-Out
}

// ---------- Kosten Einsteiger ----------

/** Schwierigkeit eines Felds (SPEC 7.1): Single 1, Double 3, Single-Bull 3, Triple 4, Bullseye 6. */
export function difficulty(f: Field): number {
  if (f.n === BULL) return f.m === 2 ? 6 : 3;
  return [0, 1, 3, 4][f.m];
}

// ---------- Suche ----------

type Plan = Field[];

const cache = new Map<string, Plan[]>();

/** Alle Wege, den Rest mit genau `darts` Darts zu checken (Reihenfolge der Vorbereitungs-Darts zählt). */
function allPlans(rest: number, darts: number, out: InOut): Plan[] {
  const k = `${rest}|${darts}|${out}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const plans: Plan[] = [];
  if (darts === 1) {
    for (const f of SCORING_FIELDS) if (points(f) === rest && qualifiesOut(out, f)) plans.push([f]);
  } else {
    for (const f of SCORING_FIELDS) {
      const after = rest - points(f);
      // Nach einem Vorbereitungs-Dart muss noch ein Checkout möglich sein (kein Bust).
      if (after < (out === 'single' ? 1 : 2)) continue;
      for (const p of allPlans(after, darts - 1, out)) plans.push([f, ...p]);
    }
  }
  cache.set(k, plans);
  return plans;
}

/** Kann der Rest mit höchstens `darts` Darts gecheckt werden? */
export function canFinish(rest: number, darts: number, out: InOut): boolean {
  for (let d = 1; d <= darts; d++) if (allPlans(rest, d, out).length) return true;
  return false;
}

function expertCost(plan: Plan, rest: number, out: InOut): number {
  let cost = plan.length * 100;
  let r = rest;
  plan.forEach((f, i) => {
    const last = i === plan.length - 1;
    cost += last ? expertFinishCost(f) : expertSetupCost(f);
    // Bei gleichen Feldern zuerst den besseren Dart werfen (T20 T19 statt T19 T20).
    if (!last) cost += expertSetupCost(f) * 0.01 * (plan.length - i);
    // Robustheit: Landet ein Triple-Vorbereitungs-Dart im Single, bleibt dann noch ein Checkout?
    if (!last && f.m === 3 && !canFinish(r - f.n, plan.length - i - 1, out)) cost += 1;
    r -= points(f);
  });
  return cost;
}

/** Ein Double zur Vorbereitung ist für Einsteiger so schwer wie ein Triple. */
const NOVICE_SETUP_DOUBLE = 4.5;

function noviceCost(plan: Plan, rest: number, out: InOut): number {
  const diff = plan.reduce(
    (s, f, i) => s + (i < plan.length - 1 && f.m === 2 && f.n !== BULL ? NOVICE_SETUP_DOUBLE : difficulty(f)),
    0,
  );
  // Erst Schwierigkeit, dann wenigste Darts, dann wie beim Experten.
  return diff * 100000 + plan.length * 10000 + expertCost(plan, rest, out);
}

const planKey = (p: Plan) => p.map(fieldLabel).join(' ');

/**
 * Checkout-Vorschlag für einen Rest mit den noch übrigen Darts dieser Aufnahme.
 * null, wenn kein Checkout möglich ist oder die Hilfe aus ist.
 */
export function suggestCheckout(rest: number, dartsLeft: number, out: InOut, level: AdviceLevel): Field[] | null {
  if (level === 'off' || dartsLeft < 1 || rest < 1 || rest > 180) return null;
  let best: Plan | null = null;
  let bestCost = Infinity;
  for (let d = 1; d <= Math.min(3, dartsLeft); d++) {
    for (const plan of allPlans(rest, d, out)) {
      const cost = level === 'expert' ? expertCost(plan, rest, out) : noviceCost(plan, rest, out);
      // Bei gleichen Kosten entscheidet die Schreibweise, damit das Ergebnis immer gleich ist.
      if (cost < bestCost || (cost === bestCost && best && planKey(plan) < planKey(best))) {
        best = plan;
        bestCost = cost;
      }
    }
  }
  return best;
}

/** Vorschlag als Text, z. B. „T20 T20 DB“. */
export function formatCheckout(plan: Field[] | null): string {
  return plan ? planKey(plan) : '';
}
