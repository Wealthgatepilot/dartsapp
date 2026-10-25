// Erzeugt die Golden-Liste der Checkouts (Double-Out, 3 Darts, Reste 2–170) und eine lesbare Tabelle zum Gegenlesen.
// Aufruf: npm run checkouts            → nur vergleichen, nichts schreiben
//         npm run checkouts -- --write → Dateien neu schreiben (nur nach Gianlucas Freigabe, die Liste ist geprüft!)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { alternativeCheckout, suggestCheckout, formatCheckout } from '../src/engine/checkout';
import { BULL, type Field } from '../src/engine/types';

const GOLDEN = 'tests/engine/golden/checkouts-double-out.json';
const REVIEW = 'docs/CHECKOUTS.md';

const LEVELS = ['expert', 'novice'] as const;
type Golden = Record<'expert' | 'novice' | 'expertAlt' | 'noviceAlt', Record<string, string>>;

const golden: Golden = { expert: {}, novice: {}, expertAlt: {}, noviceAlt: {} };
for (let rest = 2; rest <= 170; rest++) {
  for (const level of LEVELS) {
    golden[level][rest] = formatCheckout(suggestCheckout(rest, 3, 'double', level));
    const alt = alternativeCheckout(rest, 3, 'double', level);
    if (alt) golden[`${level}Alt`][rest] = formatCheckout(alt);
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

const cell = (main: string, alt: string | undefined) => (main ? (alt ? `${main}<br>oder ${alt}` : main) : '—');

const rows = [
  '# Checkout-Tabelle zum Gegenlesen',
  '',
  'Double-Out, 3 Darts. Erzeugt von `src/engine/checkout.ts`. Spalte „Hinweis“ markiert Zeilen, die einen zweiten Blick verdienen.',
  '„oder …“ ist der zweite Weg ohne Bull zur Vorbereitung (SPEC 7.1).',
  'Von Gianluca freigegeben am 25.10.2026. Diese Liste ist die Golden-Liste: Jede Zeile wird automatisch getestet.',
  '',
  '| Rest | Experte | Einsteiger | Hinweis (Experte) |',
  '|---:|---|---|---|',
];
for (let rest = 170; rest >= 2; rest--) {
  const plan = suggestCheckout(rest, 3, 'double', 'expert');
  rows.push(
    `| ${rest} | ${cell(golden.expert[rest], golden.expertAlt[rest])} | ${cell(golden.novice[rest], golden.noviceAlt[rest])} | ${notes(plan, rest).join(', ')} |`,
  );
}
const review = rows.join('\n') + '\n';
const json = JSON.stringify(golden, null, 2) + '\n';

if (process.argv.includes('--write')) {
  writeFileSync(GOLDEN, json);
  writeFileSync(REVIEW, review);
  console.log(`geschrieben: ${GOLDEN}, ${REVIEW}`);
} else {
  const same = existsSync(GOLDEN) && readFileSync(GOLDEN, 'utf8').replace(/\r\n/g, '\n') === json;
  console.log(same ? 'Golden-Liste unverändert.' : 'Golden-Liste weicht ab (oder fehlt). Mit --write neu schreiben.');
}
