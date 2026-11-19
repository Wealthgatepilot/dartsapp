// Doppel-Lage (Hinweis Gianluca 19.11.2026): Der erste Pfeil steckt knapp außerhalb von D16 (1–6 mm außen),
// der zweite geht wieder auf D16. Wie oft wird abgelenkt, und wie ändert sich die Trefferchance?
// Aufruf: npx tsx scripts/deflection-double.ts
import { BOT_SIGMA, DEFLECTION, R, aimPoint, deflect, fieldAt, planAim, seededRandom, throwAtPoint, type Point } from '../src/engine/bot';
import type { Field } from '../src/engine/types';

const D16: Field = { n: 16, m: 2 };
const hit = (f: Field) => f.n === 16 && f.m === 2;
console.log('Stufe\tTreffer ohne\tmit Ablenkung\tabgelenkt\tAbstand Ø mm');
for (const level of [3, 5, 7, 10]) {
  const random = seededRandom(31 + level);
  let a = 0, b = 0, defl = 0, distSum = 0;
  const N = 200_000;
  const aim = aimPoint(D16);
  const len = Math.hypot(aim.x, aim.y);
  for (let i = 0; i < N; i++) {
    // Erster Pfeil: knapp außen, seitlich bis ±6 mm verschoben
    const out = R.doubleOut + 1 + random() * 5;
    const side = (random() * 2 - 1) * 6;
    const ux = aim.x / len, uy = aim.y / len;
    const stuck: Point = { x: ux * out - uy * side, y: uy * out + ux * side };
    const plan = planAim(D16, [stuck]);
    const thrown = throwAtPoint(plan.point, BOT_SIGMA[level], random);
    if (hit(thrown.field)) a++;
    distSum += Math.hypot(thrown.point.x - stuck.x, thrown.point.y - stuck.y);
    const p = deflect(thrown.point, [stuck], random, DEFLECTION);
    if (p !== thrown.point) defl++;
    if (hit(fieldAt(p))) b++;
  }
  const pc = (n: number) => `${((n / N) * 100).toFixed(1).replace('.', ',')} %`;
  console.log([level, pc(a), pc(b), pc(defl), (distSum / N).toFixed(1).replace('.', ',')].join('\t'));
}
