// Ein ganzes Cricket-Spiel am simulierten Handy (SPEC 7.2): Tafel, graue Nicht-Ziele, Rückgängig, Sieg.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('ganzes Cricket-Spiel bis zum Sieg', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./#/cricket');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  await expect(page.getByRole('dialog')).toContainText('Gespielt wird auf 20, 19, 18, 17, 16, 15 und Bull');
  // Auch die nicht gewählte Variante ist erklärt (Wunsch Gianluca)
  await expect(page.getByRole('dialog').locator('dt', { hasText: 'Cut-Throat' })).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Cricket');

  // Nicht-Zielzahlen sind grau
  await expect(page.locator('.board-wrap g[data-n="1"] path.b-grey').first()).toBeVisible();
  await expect(page.locator('.board-wrap g[data-n="20"] path.b-grey')).toHaveCount(0);

  // Graue Zahlen reagieren nicht: Tippen auf die 2 (zwischen 15 und 17) trägt nichts ein
  const two = (await page.locator('.board-wrap g[data-n="2"] path').first().boundingBox())!;
  await page.mouse.move(two.x + two.width / 2, two.y + two.height / 2);
  await page.mouse.down();
  await expect(page.locator('.ringbar')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');

  const cell = (n: string, col: number) =>
    page.locator('.tafel tbody tr', { has: page.locator('th', { hasText: new RegExp(`^${n}$`) }) }).locator('td').nth(col);

  await turn(page, 'T20', 'T19', 'T18'); // Gian
  await expect(cell('20', 0)).toHaveText('Ⓧ');

  // Jörn: S20, Rückgängig, dann drei Fehlwürfe
  await dart(page, 'S20');
  await expect(cell('20', 1)).toHaveText('/');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(cell('20', 1)).toHaveText('');
  await turn(page, '0', '0', '0');

  await turn(page, 'T17', 'T16', 'T15'); // Gian
  await turn(page, 'S20', 'S20', '0'); // Jörn: 20 bei ihm halb zu
  await expect(cell('20', 1)).toHaveText('X');

  await dart(page, 'DB'); // Gian: Bull 2 Marks
  await dart(page, 'SB'); // Bull zu → alles zu, 0 gegen 0 → Sieg
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  // Gian: 9 + 9 + 3 = 21 Marks in 8 Darts → 21 / 8 × 3 = 7,875
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(3)).toHaveText('7,88');
  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: 'Cricket' })).toContainText('🏆 Gian');
});
