// Bob's 27 am simulierten Handy (SPEC 7.8): Treffer/Falsch, Plus und Minus, Ausscheiden.

import { expect, test, type Page } from '@playwright/test';
import { createProfiles } from './helpers';

async function tap(page: Page, kind: 'hit' | 'miss') {
  const pills = page.locator('.turnbox .pill');
  const before = await pills.count();
  await expect(async () => {
    if ((await pills.count()) === before) await page.locator(kind === 'hit' ? '.hm-hit' : '.hm-miss').click();
    await expect(pills).toHaveCount(before + 1, { timeout: 1000 });
  }).toPass();
}

async function next(page: Page) {
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
}

test("Bob's 27 bis zum Ausscheiden", async ({ page }) => {
  await createProfiles(page, 'Gian');
  await page.goto('./');
  await page.getByRole('link', { name: /Bob's 27/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  await expect(page.getByRole('dialog')).toContainText('Fällst du auf 0 oder darunter, scheidest du aus');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const score = page.locator('.block .block-big');
  await expect(score).toHaveText('27');
  await expect(page.locator('.hm-hit')).toHaveText('D1');

  for (let i = 0; i < 3; i++) await tap(page, 'miss');
  await expect(page.locator('.calc')).toHaveText('-2 Punkte');
  await next(page);
  await expect(score).toHaveText('25');
  await expect(page.locator('.hm-hit')).toHaveText('D2');

  await tap(page, 'hit');
  await next(page); // Rest wird mit Falsch aufgefüllt, Treffer → kein Abzug
  await expect(score).toHaveText('29');

  // D3 −6, D4 −8, D5 −10, D6 −12 → 29 − 36 = −7 → ausgeschieden, Spielende
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 3; i++) await tap(page, 'miss');
    if (k < 3) await next(page);
  }
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toBeVisible();
  await expect(end.locator('tr', { hasText: 'Gian' })).toContainText('raus');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(1)).toHaveText('-7');
});
