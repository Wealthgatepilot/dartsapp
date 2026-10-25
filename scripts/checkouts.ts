// Erzeugt die Golden-Liste der Checkouts (Double-Out, 3 Darts, Reste 2–170) und eine lesbare Tabelle zum Gegenlesen.
// Aufruf: npm run checkouts            → nur vergleichen, nichts schreiben
//         npm run checkouts -- --write → Dateien neu schreiben (nur nach Gianlucas Freigabe, die Liste ist geprüft!)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { suggestCheckout, formatCheckout, type AdviceLevel } from '../src/engine/checkout';
import { BULL, type Field } from '../src/engine/types';

const GOLDEN = 'tests/engine/golden/checkouts-double-out.json';
const REVIEW = 'docs/CHECKOUTS.md';

type Golden = Record<'expert' | 'novice', Record<string, string>>;

const golden: Golden = { expert: {}, novice: {} };
for (let rest = 2; rest <= 170; rest++) {
  for (const level of ['expert', 'novice'] as AdviceLevel[]) {
    golden[level as 'expert' | 'novice'][rest] = formatCheckout(suggestCheckout(rest, 3, 'double', level));
  }
}

/** Auffälligkeiten, die beim Gegenlesen einen zweiten Blick verdienen. */
function notes(plan: Field[] | null, rest: number): string[] {
  if (!plan) return ['kein Checkout möglich'];
  const n: string[] = [];
  const setup = plan.slice(0, -1);
  const last = plan[plan.length - 1];
  if (setup.some((f) => f.m === 2 && f.n !== BULL)) n.push('Double zur Vorbereitung');
  if (setup.some((f) => f.n === BULL)) n.push('Bull zur Vorbereitung');
  if (setup.some((f) => f.m === 3 && f.n < 15)) n.push('kleines Triple zur Vorbereitung');
  if (last.n !== BULL && last.n <= 5 && rest > 10) n.push(`endet auf D${last.n}`);
  return n;
}

const rows = [
  '# Checkout-Tabelle zum Gegenlesen',
  '',
  'Double-Out, 3 Darts. Erzeugt von `src/engine/checkout.ts`. Spalte „Hinweis“ markiert Zeilen, die einen zweiten Blick verdienen.',
  'Nach Gianlucas Freigabe ist diese Liste die Golden-Liste: Jede Zeile wird automatisch getestet.',
  '',
  '| Rest | Experte | Einsteiger | Hinweis (Experte) |',
  '|---:|---|---|---|',
];
for (let rest = 170; rest >= 2; rest--) {
  const plan = suggestCheckout(rest, 3, 'double', 'expert');
  rows.push(
    `| ${rest} | ${golden.expert[rest] || '—'} | ${golden.novice[rest] || '—'} | ${notes(plan, rest).join(', ')} |`,
  );
}
const review = rows.join('\n') + '\n';
const json = JSON.stringify(golden, null, 2) + '\n';

if (process.argv.includes('--write')) {
  writeFileSync(GOLDEN, json);
  writeFileSync(REVIEW, review);
  console.log(`geschrieben: ${GOLDEN}, ${REVIEW}`);
} else {
  const same = existsSync(GOLDEN) && readFileSync(GOLDEN, 'utf8') === json;
  console.log(same ? 'Golden-Liste unverändert.' : 'Golden-Liste weicht ab (oder fehlt). Mit --write neu schreiben.');
}
