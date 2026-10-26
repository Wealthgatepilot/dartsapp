// Schnelle Simulation von Legs 501 Double-Out für die Einstellung und Prüfung der Computer-Stufen (SPEC 9).
// Bewusst ohne Ereignisspeicher: Regeln wie in x01.ts (Bust, Double-Out), Zielwahl wie im Spiel (x01Aim).

import { planAim, throwAtPoint, x01Aim, type Point } from './bot';
import { points } from './types';

/** Rest, der mit einem einzigen Dart auf ein Double checkbar ist (Double-Versuch, SPEC 11.2). */
const doubleChance = (rest: number) => rest === 50 || (rest >= 2 && rest <= 40 && rest % 2 === 0);

/** Darts, Punkte und Double-Versuche eines simulierten Legs 501 Double-Out. */
export function simulateLeg(
  sigma: number,
  random: () => number,
  start = 501,
): { darts: number; points: number; doubleAttempts: number } {
  let rest = start;
  let darts = 0;
  let doubleAttempts = 0;
  // Sicherheitsgrenze: sehr schwache Stufen brauchen viele Darts auf das letzte Double
  while (rest > 0 && darts < 3000) {
    const turnStart = rest;
    const stuck: Point[] = []; // Darts dieser Aufnahme, die im Board stecken
    for (let i = 0; i < 3; i++) {
      darts++;
      if (doubleChance(rest)) doubleAttempts++;
      const plan = planAim(x01Aim(rest, 3 - i, 'double', null), stuck);
      const { point, field: f } = throwAtPoint(plan.point, sigma, random);
      stuck.push(point);
      const after = rest - points(f);
      if (after < 0 || after === 1 || (after === 0 && f.m !== 2)) {
        rest = turnStart; // Bust
        break;
      }
      rest = after;
      if (rest === 0) break;
    }
  }
  return { darts, points: start - rest, doubleAttempts };
}

/** 3-Dart-Average über viele Legs: alle Punkte / alle Darts × 3. */
export function simulateAverage(sigma: number, legs: number, random: () => number): number {
  return simulateStats(sigma, legs, random).average;
}

/** Average und Double-Out-Quote (Checkouts / Double-Versuche) über viele Legs. */
export function simulateStats(sigma: number, legs: number, random: () => number): { average: number; doubleRate: number; dartsPerLeg: number } {
  let darts = 0;
  let pts = 0;
  let attempts = 0;
  let checkouts = 0;
  for (let i = 0; i < legs; i++) {
    const r = simulateLeg(sigma, random);
    darts += r.darts;
    pts += r.points;
    attempts += r.doubleAttempts;
    if (r.points === 501) checkouts++;
  }
  return { average: (pts / darts) * 3, doubleRate: attempts ? (checkouts / attempts) * 100 : 0, dartsPerLeg: darts / legs };
}
