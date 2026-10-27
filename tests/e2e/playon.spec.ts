// Um die Plätze weiterspielen am simulierten Handy (SPEC 5.0): 501 mit 3 Spielern.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('501 mit 3 Spielern: Sieger, weiterspielen um Platz 2, Dritter automatisch', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn', 'Lena');
  await page.goto('./#/x01');
  for (const n of ['Gian', 'Jörn', 'Lena']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('radio', { name: 'wie eingetragen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const miss = () => turn(page, '0', '0', '0');
  await turn(page, 'T20', 'T20', 'T20'); // Gian 321
  await miss();
  await miss();
  await turn(page, 'T20', 'T20', 'T20'); // Gian 141
  await miss();
  await miss();
  for (const f of ['T20', 'T19', 'D12']) await dart(page, f); // Gian checkt

  const ask = page.getByRole('dialog', { name: 'Weiterspielen?' });
  await expect(ask).toContainText('Gian gewinnt');
  await expect(ask).toContainText('Beim Beenden teilen sich Jörn, Lena Platz 2');
  await ask.getByRole('button', { name: 'Weiterspielen um Platz 2' }).click();
  await expect(ask).toHaveCount(0);

  // Gian wird übersprungen: Jörn und Lena spielen weiter
  await expect(page.locator('.turnbox')).toContainText('Jörn');
  await turn(page, 'T20', 'T20', 'T20'); // Jörn 321
  await miss(); // Lena
  await turn(page, 'T20', 'T20', 'T20'); // Jörn 141
  await expect(page.locator('.turnbox')).toContainText('Lena');
  await miss();
  for (const f of ['T20', 'T19', 'D12']) await dart(page, f); // Jörn checkt → Platz 2, Lena Platz 3

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('.places li')).toHaveText(['1. Gian', '2. Jörn', '3. Lena']);
  await end.getByRole('button', { name: 'Fertig' }).click();

  await page.goto('./#/verlauf');
  await expect(page.locator('.game-row').first()).toContainText('🏆 Gian · 2. Jörn · 3. Lena');
});

test('501 mit 3 Spielern: Spiel beenden nach dem Sieger', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn', 'Lena');
  await page.goto('./#/x01');
  for (const n of ['Gian', 'Jörn', 'Lena']) await page.getByRole('button', { name: n }).click();
  await page.getByRole('radio', { name: 'wie eingetragen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const miss = () => turn(page, '0', '0', '0');
  await turn(page, 'T20', 'T20', 'T20');
  await miss();
  await miss();
  await turn(page, 'T20', 'T20', 'T20');
  await miss();
  await miss();
  for (const f of ['T20', 'T19', 'D12']) await dart(page, f);

  await page.getByRole('dialog', { name: 'Weiterspielen?' }).getByRole('button', { name: 'Spiel beenden' }).click();
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end.locator('.places li')).toHaveText(['1. Gian', '2. Jörn, Lena']);
});
