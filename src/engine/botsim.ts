// Schnelle Simulation von Legs 501 Double-Out für die Einstellung und Prüfung der Computer-Stufen (SPEC 9).
// Bewusst ohne Ereignisspeicher: Regeln wie in x01.ts (Bust, Double-Out), Zielwahl wie im Spiel (x01Aim).

import { planAim, throwAtPoint, x01Aim, type Point } from './bot';
import { points } from './types';

/** Darts und Punkte eines simulierten Legs 501 Double-Out. */
export function simulateLeg(sigma: number, random: () => number, start = 501): { darts: number; points: number } {
  let rest = start;
  let darts = 0;
  // Sicherheitsgrenze: sehr schwache Stufen brauchen viele Darts auf das letzte Double
  while (rest > 0 && darts < 3000) {
    const turnStart = rest;
    const stuck: Point[] = []; // Darts dieser Aufnahme, die im Board stecken
    for (let i = 0; i < 3; i++) {
      darts++;
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
  return { darts, points: start - rest };
}

/** 3-Dart-Average über viele Legs: alle Punkte / alle Darts × 3. */
export function simulateAverage(sigma: number, legs: number, random: () => number): number {
  let darts = 0;
  let pts = 0;
  for (let i = 0; i < legs; i++) {
    const r = simulateLeg(sigma, random);
    darts += r.darts;
    pts += r.points;
  }
  return (pts / darts) * 3;
}
