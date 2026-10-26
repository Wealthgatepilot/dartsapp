// Stellt die Streuung σ der Computer-Stufen ein (SPEC 9): Für jede Stufe wird σ so gesucht, dass simulierte
// Spiele 501 Double-Out (je 2 500 Spiele „first to 3“ zweier gleich starker Computer, rund 10 000 Legs)
// im Schnitt den Ziel-Average ergeben – einmal ohne, einmal mit menschlichen Schwankungen.
// Aufruf: npx tsx scripts/calibrate-bot.ts – das Ergebnis wird von Hand in src/engine/bot.ts übernommen.

import { BOT_TARGET_AVERAGE, seededRandom } from '../src/engine/bot';
import { simulateStats } from '../src/engine/botsim';

const MATCHES = 2_500;

for (const human of [false, true]) {
  console.log(human ? 'BOT_SIGMA_HUMAN (mit Schwankungen):' : 'BOT_SIGMA (ohne Schwankungen):');
  for (let level = 1; level <= 10; level++) {
    const target = BOT_TARGET_AVERAGE[level];
    const opts = { level, human };
    let lo = 1;
    let hi = 400;
    // Größeres σ = schlechterer Average: binäre Suche
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const avg = simulateStats(mid, MATCHES, seededRandom(1000 + level), opts).average;
      if (avg > target) lo = mid;
      else hi = mid;
    }
    const sigma = Math.round(((lo + hi) / 2) * 10) / 10;
    const c = simulateStats(sigma, MATCHES, seededRandom(9000 + level), opts);
    console.log(
      `  ${level}: ${sigma}, // Kontrolle ${c.average.toFixed(2)}, Doppelquote ${c.doubleRate.toFixed(1)} %, ${c.dartsPerLeg.toFixed(1)} Darts/Leg`,
    );
  }
}
