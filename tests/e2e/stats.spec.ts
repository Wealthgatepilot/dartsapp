// Statistik-Bildschirm (SPEC 11.6): nach einem gespielten Leg stehen Übersicht, Verlauf, Heatmap und Doppelquote bereit.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('Statistik nach einem X01-Leg', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  // 101 Double-Out: Gian checkt in 3 Darts (T20 S1 D20), Jörn wirft vorher daneben
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'frei' }).click();
  await page.locator('input[type=number]').fill('101');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await turn(page, 'S20', '0', '0'); // Gian 81
  await turn(page, '0', '0', '0'); // Jörn
  await dart(page, 'T20'); // Gian 21
  await dart(page, 'S1'); // 20
  await dart(page, 'D10'); // Checkout
  await page.getByRole('dialog', { name: 'Spielende' }).getByRole('button', { name: 'Fertig' }).click();

  await page.getByRole('link', { name: /Statistik/ }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Statistik');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('radio', { name: 'X01' }).click();

  // Übersicht: 101 Punkte in 6 Darts → 50,50; Darts bis Finish 6; Checkout-Aufnahme begann bei Rest 81
  const row = (label: string) => page.locator('tr', { has: page.locator('td', { hasText: label }) }).first();
  await expect(row('3-Dart-Average')).toContainText('50,50');
  await expect(row('Darts bis zum Finish')).toContainText('6');
  await expect(row('Höchster Checkout')).toContainText('81');

  // Aufnahmen: eigene Tabelle mit Schnitt je Leg, gesamt und bestem Leg
  await expect(page.locator('.table-compact tr', { hasText: 'gesamt' })).toBeVisible();
  await expect(page.locator('.table-compact tr', { hasText: 'Ø je Leg' })).toBeVisible();

  // Verlauf: Diagramm und Tabelle
  await expect(page.locator('.chart-svg')).toBeVisible();
  await page.getByRole('button', { name: 'Tabelle' }).click();
  await expect(page.locator('.chart table')).toContainText('50,50');

  // Heatmap: 6 Board-Darts; Antippen zeigt Anteil
  await expect(page.locator('.heat')).toContainText('6 Darts');

  // Doppelquote: Versuch bei Rest 20 auf D10 getroffen
  await expect(page.locator('tr', { has: page.locator('td', { hasText: /^D10$/ }) })).toContainText('1/1');
});

test('Vergleich: Spieler nebeneinander, direkt und Zeiträume (SPEC 11.7)', async ({ page }) => {
  test.setTimeout(90_000); // spielt vorher zwei Spiele durch
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');
  // Zwei Count-Up-Spiele über 1 Runde: Gian 60 und 180, Jörn 30 und 45
  for (const [g, j] of [
    [['S20', 'S20', 'S20'], ['S10', 'S10', 'S10']],
    [['T20', 'T20', 'T20'], ['S15', 'S15', 'S15']],
  ]) {
    await page.goto('./#/count-up');
    // Beim zweiten Spiel erst das gemerkte Setup abwarten (es wird kurz nach dem Öffnen geladen)
    if (g[0] === 'T20') await expect(page.locator('.order')).toContainText('Jörn');
    // Auf 1 Runde stellen (das Setup merkt sich den letzten Wert)
    const runden = Number(await page.locator('.stepper[aria-label="Runden"] span').innerText());
    for (let i = 1; i < runden; i++) await page.getByRole('button', { name: 'Runden weniger' }).click();
    await expect(page.locator('.stepper[aria-label="Runden"] span')).toHaveText('1');
    if (!(await page.locator('.order').getByText('Gian').count())) await page.getByRole('button', { name: 'Gian' }).click();
    if (!(await page.locator('.order').getByText('Jörn').count())) await page.getByRole('button', { name: 'Jörn' }).click();
    await page.getByRole('radio', { name: 'wie eingetragen' }).click();
    await page.getByRole('button', { name: 'Spiel starten' }).click();
    await turn(page, ...g);
    for (const f of j) await dart(page, f);
    await page.getByRole('dialog', { name: 'Spielende' }).getByRole('button', { name: 'Fertig' }).click();
    // „Fertig“ führt zur Startseite; erst danach weiter, sonst überholt dieser Wechsel den nächsten Aufruf
    await expect(page.getByRole('heading', { name: 'Letzte Spiele' })).toBeVisible();
  }

  await page.goto('./#/statistik');
  await page.getByRole('radio', { name: 'Vergleich' }).click();
  await page.getByRole('radio', { name: 'Count-Up' }).click();

  // Spieler nebeneinander: Gian Schnitt 120, Jörn 37,5; Gian hervorgehoben
  await page.getByRole('radio', { name: 'Spieler' }).click();
  const points = page.locator('.compare-table tr', { has: page.locator('td', { hasText: 'Endpunkte' }) });
  await expect(points.locator('td').nth(1)).toContainText('120,0');
  await expect(points.locator('td').nth(1)).toHaveClass(/compare-best/);
  await expect(points.locator('td').nth(2)).toContainText('37,5');
  await expect(page.locator('.chart-legend')).toContainText('Gian');
  await expect(page.locator('.chart-legend')).toContainText('Jörn');
  await expect(page.getByRole('heading', { name: 'Treffer-Heatmap' })).toHaveCount(0); // nur in der Einzelansicht

  // Direkt: 2 : 0
  await page.getByRole('radio', { name: 'Direkt' }).click();
  await expect(page.locator('.duel-score')).toContainText('2 : 0');
  await expect(page.locator('.list-row')).toHaveCount(2);

  // Zeiträume: beide Spiele in „jetzt“, vorher leer
  await page.getByRole('radio', { name: 'Zeiträume' }).click();
  await expect(page.getByRole('radio', { name: 'alles' })).toHaveCount(0); // eigenes Zeitfenster statt Zeitraum-Filter
  const row = page.locator('.compare-table tr', { has: page.locator('td', { hasText: 'Endpunkte' }) });
  await expect(row.locator('td').nth(1)).toHaveText('—');
  await expect(row.locator('td').nth(2)).toContainText('120,0');
});

test('Vergleich im Training: Quote je Doppel und Darts je Treffer', async ({ page }) => {
  test.setTimeout(90_000);
  await createProfiles(page, 'Gian', 'Jörn');
  await page.goto('./#/training');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('button', { name: 'Keine' }).click();
  await page.getByRole('button', { name: 'D16', exact: true }).click();
  await page.getByRole('button', { name: 'D20', exact: true }).click();
  await page.getByRole('radio', { name: 'wie eingetragen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  const pills = page.locator('.turnbox .pill');
  const tap = async (kind: 'hit' | 'miss', n: number) => {
    await page.locator(kind === 'hit' ? '.hm-hit' : '.hm-miss').click();
    await expect(pills).toHaveCount(n);
  };
  await tap('hit', 1);
  await tap('hit', 2); // Gian fertig: 2/2
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await page.getByRole('dialog', { name: 'Weiterspielen?' }).getByRole('button', { name: 'Weiterspielen' }).click();
  await tap('miss', 1);
  await tap('hit', 2);
  await page.locator('.hm-hit').click(); // Jörn fertig: 2/3 → Spielende
  await page.getByRole('dialog', { name: 'Spielende' }).getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('heading', { name: 'Letzte Spiele' })).toBeVisible();

  await page.goto('./#/statistik');
  await page.getByRole('radio', { name: 'Vergleich' }).click();
  await page.getByRole('radio', { name: 'Training' }).click();
  await page.getByRole('radio', { name: 'Spieler' }).click();
  const total = page.locator('.card', { hasText: 'Quote je Doppel' }).locator('tr', { hasText: 'Gesamt' });
  await expect(total.locator('td').nth(1)).toContainText('100,0 %');
  await expect(total.locator('td').nth(1)).toHaveClass(/compare-best/);
  await expect(total.locator('td').nth(2)).toContainText('66,7 %');
  await expect(page.locator('.card', { hasText: 'Quote je Doppel' }).locator('tr', { hasText: 'D16' })).toBeVisible();
  await expect(page.locator('.compare-table tr', { hasText: 'Darts je Treffer' }).locator('td').nth(2)).toContainText('1,5');

  // Direkt und Zeiträume zeigen die Tabelle ebenfalls
  await page.getByRole('radio', { name: 'Direkt' }).click();
  await expect(page.getByRole('heading', { name: 'Quote je Doppel in diesen Spielen' })).toBeVisible();
  await page.getByRole('radio', { name: 'Zeiträume' }).click();
  await expect(page.getByRole('heading', { name: 'Quote je Doppel' })).toBeVisible();
});
