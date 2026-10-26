// Computergegner nach SPEC 9: Er zielt auf die Mitte eines Feldes und trifft mit zufälliger Streuung daneben.
// Die Streuung ist eine Normalverteilung um den Zielpunkt; je kleiner σ (in mm), desto stärker der Computer.
// So entstehen echte Fehlwürfe, z. B. 1 und 5 neben der 20.

import { suggestCheckout } from './checkout';
import { BOARD_ORDER, BULL, MISS, points, type Field } from './types';
import type { InOut } from './x01';

/** Radien in mm (SPEC Kapitel 1). */
export const R = {
  bullseye: 6.35,
  bull: 15.9,
  tripleIn: 99,
  tripleOut: 107,
  doubleIn: 162,
  doubleOut: 170,
} as const;

/**
 * Streuung σ in mm je Stärkestufe 1–10. Eingestellt per Simulation (`scripts/calibrate-bot.ts`), sodass
 * 501 Double-Out im Schnitt diese 3-Dart-Averages ergibt: 25, 35, 45, 52, 60, 67, 75, 83, 92, 100 (SPEC 9).
 */
export const BOT_SIGMA: Record<number, number> = {
  1: 34.7, // Kontrolle (10 000 Legs, anderer Zufall): 24,98
  2: 24, // 34,77
  3: 18.2, // 45,13
  4: 15.6, // 52,02
  5: 13.3, // 60,22
  6: 11.7, // 66,83
  7: 10.1, // 75,17
  8: 8.7, // 83,23
  9: 7.3, // 92,89
  10: 6.4, // 99,40
};

export const BOT_TARGET_AVERAGE: Record<number, number> = { 1: 25, 2: 35, 3: 45, 4: 52, 5: 60, 6: 67, 7: 75, 8: 83, 9: 92, 10: 100 };

export interface Point {
  x: number;
  y: number;
}

/** Feld an einer Stelle des Boards (mm, Mitte = 0/0, y nach oben). */
export function fieldAt(p: Point): Field {
  const r = Math.hypot(p.x, p.y);
  if (r <= R.bullseye) return { n: BULL, m: 2 };
  if (r <= R.bull) return { n: BULL, m: 1 };
  if (r > R.doubleOut) return MISS;
  // Winkel im Uhrzeigersinn ab oben; die 20 liegt bei −9° … +9°
  const deg = ((Math.atan2(p.x, p.y) * 180) / Math.PI + 360 + 9) % 360;
  const n = BOARD_ORDER[Math.floor(deg / 18)];
  if (r >= R.doubleIn) return { n, m: 2 };
  if (r >= R.tripleIn && r <= R.tripleOut) return { n, m: 3 };
  return { n, m: 1 };
}

/** Mitte eines Feldes als Zielpunkt. Beim Single wird das große äußere Segment angepeilt. */
export function aimPoint(f: Field): Point {
  if (f.n === BULL) return f.m === 2 ? { x: 0, y: 0 } : { x: 0, y: (R.bullseye + R.bull) / 2 };
  if (f.m === 0) return { x: 0, y: 0 };
  const radius = f.m === 2 ? (R.doubleIn + R.doubleOut) / 2 : f.m === 3 ? (R.tripleIn + R.tripleOut) / 2 : (R.tripleOut + R.doubleIn) / 2;
  const a = (BOARD_ORDER.indexOf(f.n as (typeof BOARD_ORDER)[number]) * 18 * Math.PI) / 180;
  return { x: Math.sin(a) * radius, y: Math.cos(a) * radius };
}

/** Normalverteilte Zufallszahl (Box-Muller). `random` liefert Werte in [0, 1). */
export function gaussian(random: () => number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Ein Wurf auf `target` mit Streuung σ (mm): liefert das getroffene Feld. */
export function throwAt(target: Field, sigma: number, random: () => number): Field {
  const aim = aimPoint(target);
  return fieldAt({ x: aim.x + gaussian(random) * sigma, y: aim.y + gaussian(random) * sigma });
}

/** Wiederholbarer Zufall für Tests und Simulation (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Zielwahl X01 (SPEC 9: T20 bis Rest ≤ 170, dann Experten-Checkout) ----------

const checkoutCache = new Map<string, Field[] | null>();
function checkout(rest: number, darts: number, out: InOut): Field[] | null {
  const key = `${rest}|${darts}|${out}`;
  if (!checkoutCache.has(key)) checkoutCache.set(key, suggestCheckout(rest, darts, out, 'expert'));
  return checkoutCache.get(key)!;
}

/** Rest nach einem Dart ist erlaubt (kein Bust, außer es ist der Checkout). */
function safeRest(after: number, out: InOut): boolean {
  return out === 'single' ? after >= 1 : after >= 2;
}

/**
 * Worauf der Computer bei X01 bzw. 121 zielt.
 * Ohne Checkout-Weg: T20, oder bei kleinem Rest ein Feld, das einen guten Rest für die nächsten Darts lässt.
 */
export function x01Aim(rest: number, dartsLeft: number, out: InOut, needsIn: InOut | null): Field {
  if (needsIn === 'double') return { n: 20, m: 2 };
  if (needsIn === 'master') return { n: 20, m: 3 };
  const plan = checkout(rest, dartsLeft, out);
  if (plan) return plan[0];
  if (rest > 170) return { n: 20, m: 3 };
  // Kein Checkout mit den übrigen Darts: einen Rest stellen, der mit 2 Darts checkbar ist
  const setup = setupShot(rest, out);
  if (setup) return setup;
  if (safeRest(rest - 60, out)) return { n: 20, m: 3 };
  for (let n = 20; n >= 1; n--) if (safeRest(rest - n, out)) return { n, m: 1 };
  return { n: 1, m: 1 };
}

/** Bestes Single (bzw. Triple) für einen Rest, der danach mit 2 Darts checkbar ist. */
function setupShot(rest: number, out: InOut): Field | null {
  const candidates: Field[] = [
    ...[20, 19, 18, 17, 16, 15].map((n) => ({ n, m: 3 as const })),
    ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 1 as const })),
    { n: BULL, m: 1 },
  ];
  for (const f of candidates) {
    const after = rest - points(f);
    if (safeRest(after, out) && checkout(after, 2, out)) return f;
  }
  return null;
}

/** Wie lange der Computer zwischen zwei Darts wartet (SPEC 9). */
export const BOT_DELAY_MS = 800;
