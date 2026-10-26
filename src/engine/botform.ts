// Menschliche Schwankungen des Computers (Wunsch Gianluca, 26.10.2026): Tagesform, hot/cold streaks und Druck.
// Alles wirkt über die Streuung σ: gute Form = enger, Druck = weiter. Im Schnitt bleiben die Stufen-Averages,
// weil die Stufen mit diesen Schwankungen eingestellt sind (scripts/calibrate-bot.ts).

import { seededRandom, gaussian } from './bot';

/** Tagesform: Abweichung je Spiel (log-Skala, Standardabweichung). */
export const DAY_FORM_SD = 0.08;
/** Streaks: Anteil der bisherigen Form, der in die nächste Aufnahme übernommen wird. */
export const STREAK_KEEP = 0.8;
/** Streaks: neue Abweichung je Aufnahme. Zusammen ergibt das typische Phasen von etwa ±10 %. */
export const STREAK_SD = 0.06;

/**
 * Formfaktor für die n-te Aufnahme (ab 1) eines Computers in einem Spiel: σ wird damit multipliziert.
 * Hängt nur von der Zufallszahl des Spiels, dem Platz und n ab – nach einem Neuladen bleibt die Form gleich.
 */
export function formFactor(seed: number, slot: number, turnNumber: number): number {
  const random = seededRandom((seed ^ Math.imul(slot + 1, 0x9e3779b1)) >>> 0);
  const day = gaussian(random) * DAY_FORM_SD;
  let streak = 0;
  for (let k = 1; k <= turnNumber; k++) streak = STREAK_KEEP * streak + gaussian(random) * STREAK_SD;
  return Math.exp(day + streak);
}

/** Wie stark Druck die Stufe trifft: Stufe 1 = 0,40 … Stufe 10 = 0,13 (Profis sind nervenstärker). */
export function pressureSensitivity(level: number): number {
  return 0.4 - 0.03 * (level - 1);
}

export interface PressureSituation {
  /** Der Dart könnte das Leg beenden (Checkout-Dart). Nur dann wirkt Druck. */
  checkoutDart: boolean;
  /** Gewinnt dieser Checkout das ganze Spiel? */
  matchDart: boolean;
  /** Ein Gegner steht selbst auf einem Finish (Rest mit 3 Darts checkbar). */
  opponentOnFinish: boolean;
  /** Bisher verpasste Double-Versuche in diesem Leg. */
  missedDoubles: number;
}

/** Druck 0 … 1 in einer Situation. */
export function pressure(s: PressureSituation): number {
  if (!s.checkoutDart) return 0;
  const p = (s.matchDart ? 0.5 : 0) + (s.opponentOnFinish ? 0.3 : 0) + Math.min(0.4, 0.1 * s.missedDoubles);
  return Math.min(1, p);
}

/** Streuung eines Darts mit Schwankungen: Grundstreuung × Form × (1 + Druck × Empfindlichkeit). */
export function effectiveSigma(base: number, level: number, form: number, situation: PressureSituation | null): number {
  return base * form * (1 + (situation ? pressure(situation) : 0) * pressureSensitivity(level));
}

/** Reste, die mit 3 Darts nicht checkbar sind (Double-Out). */
const BOGEY = new Set([169, 168, 166, 165, 163, 162, 159]);
export function onFinish(rest: number): boolean {
  return rest >= 2 && rest <= 170 && !BOGEY.has(rest);
}
