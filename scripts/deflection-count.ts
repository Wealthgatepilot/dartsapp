// Wie oft wird abgelenkt, und wie oft bringt es Glück oder Pech? 100 000 Aufnahmen auf T20 je Stufe (Vorschlag 19.11.2026).
// Aufruf: npx tsx scripts/deflection-count.ts
import { BOT_SIGMA, DEFLECTION, deflect, fieldAt, planAim, seededRandom, throwAtPoint, type Point } from '../src/engine/bot';
import { points, type Field } from '../src/engine/types';

const T20: Field = { n: 20, m: 3 };
console.log('Stufe\tabgelenkt je Dart\tdavon Pech\tGlück\tgleich\tØ Punkte je Ablenkung');
for (const level of [1, 3, 5, 7, 9, 10]) {
  const random = seededRandom(77 + level);
  let darts = 0, deflected = 0, worse = 0, better = 0, same = 0, delta = 0;
  for (let turn = 0; turn < 100_000; turn++) {
    const stuck: Point[] = [];
    for (let i = 0; i < 3; i++) {
      darts++;
      const plan = planAim(T20, stuck);
      const thrown = throwAtPoint(plan.point, BOT_SIGMA[level], random);
      const p = deflect(thrown.point, stuck, random, DEFLECTION);
      if (p !== thrown.point) {
        deflected++;
        const d = points(fieldAt(p)) - points(thrown.field);
        delta += d;
        if (d < 0) worse++;
        else if (d > 0) better++;
        else same++;
      }
      stuck.push(p);
    }
  }
  const pc = (n: number, of: number) => `${((n / of) * 100).toFixed(1).replace('.', ',')} %`;
  console.log([level, pc(deflected, darts), pc(worse, deflected), pc(better, deflected), pc(same, deflected), (delta / deflected).toFixed(1).replace('.', ',')].join('\t'));
}
