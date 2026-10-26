// Schnelle Simulation von 501 Double-Out für die Einstellung und Prüfung der Computer-Stufen (SPEC 9).
// Bewusst ohne Ereignisspeicher: Regeln wie in x01.ts (Bust, Double-Out), Zielwahl wie im Spiel (x01Aim, planAim).
// Zwei gleich starke Computer spielen „first to 3“ gegeneinander, damit Druck (Matchdart, Gegner auf Finish)
// so oft vorkommt wie in echten Spielen.

import { gaussian, planAim, throwAtPoint, x01Aim, type Point } from './bot';
import { DAY_FORM_SD, STREAK_KEEP, STREAK_SD, effectiveSigma, onFinish } from './botform';
import { points } from './types';

/** Rest, der mit einem einzigen Dart auf ein Double checkbar ist (Double-Versuch, SPEC 11.2). */
const doubleChance = (rest: number) => rest === 50 || (rest >= 2 && rest <= 40 && rest % 2 === 0);

export interface SimOptions {
  /** Stärkestufe (für die Druck-Empfindlichkeit). */
  level: number;
  /** Menschliche Schwankungen an. */
  human: boolean;
}

interface Tally {
  darts: number;
  points: number;
  doubleAttempts: number;
  checkouts: number;
  legs: number;
}

const LEGS_TO_WIN = 3;

/** Ein Spiel „first to 3“ zweier gleich starker Computer; zählt für beide zusammen. */
function simulateMatch(sigma: number, opts: SimOptions, random: () => number, t: Tally): void {
  const day = [0, 1].map(() => (opts.human ? gaussian(random) * DAY_FORM_SD : 0));
  const streak = [0, 0];
  const won = [0, 0];
  for (let leg = 0; won[0] < LEGS_TO_WIN && won[1] < LEGS_TO_WIN; leg++) {
    const rest = [501, 501];
    const missed = [0, 0];
    let winner = -1;
    for (let turn = 0; winner < 0 && turn < 2000; turn++) {
      const p = (leg + turn) % 2; // Anwurf wechselt je Leg
      if (opts.human) streak[p] = STREAK_KEEP * streak[p] + gaussian(random) * STREAK_SD;
      const form = Math.exp(day[p] + streak[p]);
      const turnStart = rest[p];
      const stuck: Point[] = [];
      for (let i = 0; i < 3; i++) {
        t.darts++;
        const chance = doubleChance(rest[p]);
        if (chance) t.doubleAttempts++;
        const plan = planAim(x01Aim(rest[p], 3 - i, 'double', null), stuck);
        const checkoutDart = plan.target.m === 2 && points(plan.target) === rest[p];
        const s = opts.human
          ? effectiveSigma(sigma, opts.level, form, {
              checkoutDart,
              matchDart: won[p] === LEGS_TO_WIN - 1,
              opponentOnFinish: onFinish(rest[1 - p]),
              missedDoubles: missed[p],
            })
          : sigma;
        const { point, field: f } = throwAtPoint(plan.point, s, random);
        stuck.push(point);
        const after = rest[p] - points(f);
        if (after < 0 || after === 1 || (after === 0 && f.m !== 2)) {
          if (chance) missed[p]++;
          t.points -= turnStart - rest[p]; // Bust: die Punkte dieser Aufnahme zählen nicht
          rest[p] = turnStart;
          break;
        }
        t.points += points(f);
        rest[p] = after;
        if (after === 0) {
          t.checkouts++;
          winner = p;
          break;
        }
        if (chance) missed[p]++;
      }
    }
    if (winner >= 0) won[winner]++;
    else break; // Sicherheitsgrenze bei sehr schwachen Stufen
    t.legs++;
  }
}

/** Average, Double-Out-Quote und Darts pro Leg über viele Spiele. */
export function simulateStats(
  sigma: number,
  matches: number,
  random: () => number,
  opts: SimOptions = { level: 5, human: false },
): { average: number; doubleRate: number; dartsPerLeg: number } {
  const t: Tally = { darts: 0, points: 0, doubleAttempts: 0, checkouts: 0, legs: 0 };
  for (let i = 0; i < matches; i++) simulateMatch(sigma, opts, random, t);
  return {
    average: (t.points / t.darts) * 3,
    doubleRate: t.doubleAttempts ? (t.checkouts / t.doubleAttempts) * 100 : 0,
    // Beide Spieler werfen im Leg: Darts je Spieler und Leg
    dartsPerLeg: t.darts / t.legs / 2,
  };
}

/** 3-Dart-Average über viele Spiele: alle Punkte / alle Darts × 3. */
export function simulateAverage(sigma: number, matches: number, random: () => number, opts?: SimOptions): number {
  return simulateStats(sigma, matches, random, opts).average;
}
