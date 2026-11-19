// Wie würde sich die Ablenkung an steckenden Darts auf die Computer-Stufen auswirken? (Vorschlag 19.11.2026)
// Je Stufe 2 500 Spiele „first to 3“ (rund 10 000 Legs) 501 Double-Out, ohne und mit Ablenkung, gleicher Zufall.
// Aufruf: npx tsx scripts/deflection-sim.ts
import { BOT_SIGMA, BOT_SIGMA_HUMAN, DEFLECTION, seededRandom } from '../src/engine/bot';
import { simulateStats } from '../src/engine/botsim';

const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
const diff = (a: number, b: number) => `${b - a >= 0 ? '+' : '−'}${fmt(Math.abs(b - a))}`;

for (const human of [false, true]) {
  console.log(`\n${human ? 'MIT' : 'OHNE'} Schwankungen`);
  console.log('Stufe\tØ ohne\tØ mit\tΔ Ø\tDO ohne\tDO mit\tΔ DO\tDarts/Leg ohne\tmit');
  for (let level = 1; level <= 10; level++) {
    const sigma = (human ? BOT_SIGMA_HUMAN : BOT_SIGMA)[level];
    const a = simulateStats(sigma, 2_500, seededRandom(900 + level), { level, human });
    const b = simulateStats(sigma, 2_500, seededRandom(900 + level), { level, human, deflection: DEFLECTION });
    console.log(
      [level, fmt(a.average, 2), fmt(b.average, 2), diff(a.average, b.average), fmt(a.doubleRate) + ' %', fmt(b.doubleRate) + ' %', diff(a.doubleRate, b.doubleRate), fmt(a.dartsPerLeg), fmt(b.dartsPerLeg)].join('\t'),
    );
  }
}
