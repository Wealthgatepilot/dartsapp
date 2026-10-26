// Zeigt je Computer-Stufe Average, Double-Out-Quote und Darts pro Leg (501 Double-Out, 10 000 Legs).
// Aufruf: npx tsx scripts/bot-stats.ts
import { BOT_SIGMA, seededRandom } from '../src/engine/bot';
import { simulateStats } from '../src/engine/botsim';

for (let level = 1; level <= 10; level++) {
  const s = simulateStats(BOT_SIGMA[level], 10_000, seededRandom(500 + level));
  console.log(`${level}\t${s.average.toFixed(1)}\t${s.doubleRate.toFixed(1)} %\t${s.dartsPerLeg.toFixed(1)}`);
}
