// Ein ganzes Around the Clock am simulierten Handy (SPEC 7.5): nur das Ziel farbig, Sprünge, Sieg sofort.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('Around the Clock mit Sprüngen bis zum Sieg', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./');
  await page.getByRole('link', { name: /Around the Clock/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'an' }).click(); // Sprünge
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: Around the Clock' });
  await expect(rules).toContainText('Ein Double bringt dich 2 Ziele weiter');
  await expect(rules.locator('dt', { hasText: 'Nur Triples' })).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Around the Clock · mit Sprüngen');

  const target = (name: string) => page.locator('.score-card', { hasText: name }).locator('.score-rest');
  await expect(target('Gian')).toHaveText('1');
  await expect(page.locator('.board-wrap g[data-n="1"] path.b-grey')).toHaveCount(0);
  await expect(page.locator('.board-wrap g[data-n="2"] path.b-grey').first()).toBeVisible();

  await dart(page, 'T1');
  await expect(target('Gian')).toHaveText('4'); // Ziel wechselt mitten in der Aufnahme
  await expect(page.locator('.board-wrap g[data-n="4"] path.b-grey')).toHaveCount(0);
  await dart(page, 'T4');
  await dart(page, 'T7');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(target('Gian')).toHaveText('10');
  await turn(page, '0', '0', '0'); // Jörn
  await turn(page, 'T10', 'T13', 'T16'); // Gian → 19
  await turn(page, 'S1', '0', '0'); // Jörn → 2
  await expect(target('Jörn')).toHaveText('2');
  await dart(page, 'D19'); // über das Ende hinaus → Sieg sofort

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(1)).toHaveText('20/20');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(2)).toHaveText('7');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(3)).toHaveText('100 %');
  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: 'Around the Clock' })).toContainText('🏆 Gian');
});
