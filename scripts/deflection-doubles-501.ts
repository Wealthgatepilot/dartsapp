// Doppelquote im 501 aufgeschlüsselt (Frage Gianluca 19.11.2026): Versuche ohne steckenden Dart in der Nähe
// gegen Versuche mit einem Dart dieser Aufnahme ≤ 20 mm am Zielpunkt (z. B. knapp außen verfehlt, alle drei aufs Doppel).
// Je Stufe 2 500 Spiele „first to 3“, ohne und mit Ablenkung, gleicher Zufall. Aufruf: npx tsx scripts/deflection-doubles-501.ts
import { BOT_SIGMA, BOT_SIGMA_HUMAN, DEFLECTION, seededRandom } from '../src/engine/bot';
import { simulateStats } from '../src/engine/botsim';

const pc = (h: number, n: number) => (n ? `${((h / n) * 100).toFixed(1).replace('.', ',')} %` : '—');
for (const human of [false, true]) {
  console.log(`\n${human ? 'MIT' : 'OHNE'} Schwankungen`);
  console.log('Stufe\tAnteil nah\tfrei ohne\tfrei mit\tnah ohne\tnah mit\tgesamt ohne\tgesamt mit');
  for (const level of [3, 5, 7, 8, 9, 10]) {
    const run = (deflection: boolean) => {
      const c = { free: 0, freeHit: 0, near: 0, nearHit: 0 };
      simulateStats((human ? BOT_SIGMA_HUMAN : BOT_SIGMA)[level], 2_500, seededRandom(900 + level), {
        level,
        human,
        ...(deflection ? { deflection: DEFLECTION } : {}),
        onDouble: (near, hit) => {
          if (near) (c.near++, hit && c.nearHit++);
          else (c.free++, hit && c.freeHit++);
        },
      });
      return c;
    };
    const a = run(false);
    const b = run(true);
    const all = (c: typeof a) => pc(c.freeHit + c.nearHit, c.free + c.near);
    console.log([level, pc(a.near, a.near + a.free), pc(a.freeHit, a.free), pc(b.freeHit, b.free), pc(a.nearHit, a.near), pc(b.nearHit, b.near), all(a), all(b)].join('\t'));
  }
}
