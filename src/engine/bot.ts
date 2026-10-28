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
  // Kontrolle (2 500 Spiele „first to 3“, anderer Zufall): Average, Double-Out-Quote
  1: 43.9, // 24,80 · 3,2 %
  2: 28.2, // 35,04 · 7,3 %
  3: 20.4, // 44,96 · 12,2 %
  4: 17.2, // 51,99 · 15,8 %
  5: 14.5, // 60,35 · 20,2 %
  6: 12.8, // 66,64 · 22,9 %
  7: 11, // 74,83 · 27,1 %
  8: 9.5, // 82,95 · 32,1 %
  9: 8, // 92,11 · 37,7 %
  10: 6.9, // 99,74 · 42,7 %
};

/** Streuung je Stufe mit menschlichen Schwankungen (botform.ts: Tagesform, Streaks, Druck), eingestellt wie BOT_SIGMA. */
export const BOT_SIGMA_HUMAN: Record<number, number> = {
  1: 37.5, // 24,87 · 2,8 %
  2: 25.7, // 34,95 · 5,8 %
  3: 19.5, // 44,67 · 9,7 %
  4: 16.6, // 52,05 · 13,6 %
  5: 14.2, // 59,76 · 16,9 %
  6: 12.5, // 66,79 · 20,8 %
  7: 10.8, // 74,85 · 25,2 %
  8: 9.3, // 83,30 · 30,7 %
  9: 7.9, // 92,09 · 36,1 %
  10: 6.8, // 99,95 · 41,6 %
};

export const BOT_TARGET_AVERAGE: Record<number, number> = { 1: 25, 2: 35, 3: 45, 4: 52, 5: 60, 6: 67, 7: 75, 8: 83, 9: 92, 10: 100 };

/** „Stufen erklärt“ (SPEC 9): Ø 3 Darts und Doppelquote aus der Einstellung ohne Schwankungen (gerundet), dazu eine Einordnung. */
export const BOT_LEVEL_INFO: Record<number, { avg: number; doubleRate: number; like: string }> = {
  1: { avg: 25, doubleRate: 3, like: 'Anfänger' },
  2: { avg: 35, doubleRate: 7, like: 'Gelegenheitsspieler' },
  3: { avg: 45, doubleRate: 12, like: 'Hobbyspieler' },
  4: { avg: 52, doubleRate: 16, like: 'Kneipen-Stammspieler' },
  5: { avg: 60, doubleRate: 20, like: 'guter Kneipenspieler' },
  6: { avg: 67, doubleRate: 23, like: 'Vereinsspieler' },
  7: { avg: 75, doubleRate: 27, like: 'starker Ligaspieler' },
  8: { avg: 83, doubleRate: 32, like: 'Spitze der Liga' },
  9: { avg: 92, doubleRate: 38, like: 'Halbprofi' },
  10: { avg: 100, doubleRate: 43, like: 'Profi' },
};

/** Kurze Zeile zur Stufe, z. B. „Stufe 5 ≈ Ø 60 Punkte je Aufnahme, trifft etwa jedes 5. Doppel“. */
export function botLevelLine(level: number): string {
  const i = BOT_LEVEL_INFO[level];
  return `Stufe ${level} ≈ Ø ${i.avg} Punkte je Aufnahme, trifft etwa jedes ${Math.round(100 / i.doubleRate)}. Doppel`;
}

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
  return throwAtPoint(aimPoint(target), sigma, random).field;
}

/** Ein Wurf auf einen Punkt: liefert die Stelle, an der der Dart steckt, und das Feld. */
export function throwAtPoint(aim: Point, sigma: number, random: () => number): { point: Point; field: Field } {
  const point = { x: aim.x + gaussian(random) * sigma, y: aim.y + gaussian(random) * sigma };
  return { point, field: fieldAt(point) };
}

// ---------- Verdeckte Ziele (Wunsch Gianluca, 26.10.2026) ----------
// Steckt ein Dart der laufenden Aufnahme direkt vor dem Zielpunkt, wirft man nicht stur darauf:
// Verdeckt ein knapp verfehlter Dart das Ziel, wechseln Profis das Feld (T20 → T19 → T18);
// steckt er im Ziel selbst, zielen sie etwas zur Seite.

/** Ab diesem Abstand (mm) zum Zielpunkt gilt ein steckender Dart als verdeckend. */
export const BLOCK_MM = 7;
/** So weit (mm) wird zur Seite gezielt, wenn ein Dart im Ziel steckt oder es kein Ersatzfeld gibt. */
export const SIDESTEP_MM = 8;

const sameField = (a: Field, b: Field) => a.n === b.n && a.m === b.m;
const SCORING_SWITCH: Field[] = [20, 19, 18].map((n) => ({ n, m: 3 as const }));

const blockers = (aim: Point, darts: readonly Point[]) => darts.filter((d) => Math.hypot(d.x - aim.x, d.y - aim.y) < BLOCK_MM);

/** Zielpunkt entlang des Rings seitlich verschieben, weg vom verdeckenden Dart. */
function sidestep(aim: Point, from: Point): Point {
  const r = Math.hypot(aim.x, aim.y);
  if (r < 1) return { x: aim.x + (from.x > 0 ? -SIDESTEP_MM : SIDESTEP_MM), y: aim.y }; // am Bull: waagrecht ausweichen
  // Tangente an den Ring durch den Zielpunkt
  const tx = aim.y / r;
  const ty = -aim.x / r;
  const side = (from.x - aim.x) * tx + (from.y - aim.y) * ty >= 0 ? -1 : 1;
  return { x: aim.x + side * tx * SIDESTEP_MM, y: aim.y + side * ty * SIDESTEP_MM };
}

/**
 * Wohin der Computer wirklich zielt, wenn schon Darts stecken (`darts`: Stellen der Darts dieser Aufnahme).
 * Liefert das (evtl. gewechselte) Zielfeld und den Zielpunkt.
 */
export function planAim(target: Field, darts: readonly Point[]): { target: Field; point: Point } {
  const aim = aimPoint(target);
  const block = blockers(aim, darts);
  if (!block.length) return { target, point: aim };
  // Steckt der Dart im Ziel selbst, bleibt das Ziel, nur etwas zur Seite
  const missBlock = block.find((d) => !sameField(fieldAt(d), target));
  if (!missBlock) return { target, point: sidestep(aim, block[0]) };
  // Ein knapp verfehlter Dart verdeckt das Ziel: beim Punkten auf das nächste Triple wechseln
  const i = SCORING_SWITCH.findIndex((f) => sameField(f, target));
  if (i >= 0) {
    for (const alt of [...SCORING_SWITCH.slice(i + 1), ...SCORING_SWITCH.slice(0, i)]) {
      const p = aimPoint(alt);
      if (!blockers(p, darts).length) return { target: alt, point: p };
    }
  }
  return { target, point: sidestep(aim, missBlock) };
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
