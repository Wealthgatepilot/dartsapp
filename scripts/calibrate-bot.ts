// Stellt die Streuung σ der Computer-Stufen ein (SPEC 9): Für jede Stufe wird σ so gesucht, dass
// 10 000 simulierte Legs 501 Double-Out im Schnitt den Ziel-Average ergeben. Aufruf: npx tsx scripts/calibrate-bot.ts
// Das Ergebnis wird von Hand in BOT_SIGMA (src/engine/bot.ts) übernommen.

import { BOT_TARGET_AVERAGE, seededRandom } from '../src/engine/bot';
import { simulateAverage } from '../src/engine/botsim';

const LEGS = 10_000;

for (let level = 1; level <= 10; level++) {
  const target = BOT_TARGET_AVERAGE[level];
  let lo = 1;
  let hi = 400;
  // Größeres σ = schlechterer Average: binäre Suche
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const avg = simulateAverage(mid, LEGS, seededRandom(1000 + level));
    if (avg > target) lo = mid;
    else hi = mid;
  }
  const sigma = Math.round(((lo + hi) / 2) * 10) / 10;
  const check = simulateAverage(sigma, LEGS, seededRandom(9000 + level));
  console.log(`  ${level}: ${sigma}, // Ziel ${target}, Kontrolle ${check.toFixed(2)}`);
}
