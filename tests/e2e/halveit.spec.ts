// Halve-It am simulierten Handy (SPEC 7.9): eigene Zielfolge, Halbieren, Sieger.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('Halve-It mit eigener Zielfolge 20 und Double', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./');
  await page.getByRole('link', { name: /Halve-It/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('button', { name: 'Alle entfernen' }).click();
  await expect(page.getByText('1 bis 30 Ziele.')).toBeVisible();
  await page.getByRole('button', { name: '20 anhängen' }).click();
  await page.getByRole('button', { name: 'Double anhängen' }).click();
  await page.getByRole('button', { name: 'Startpunkte mehr' }).click(); // 10
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: Halve-It' });
  await expect(rules).toContainText('2 Runden mit diesen Zielen: 20, beliebiges Double');
  await expect(rules).toContainText('Jeder startet mit 10 Punkten');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.locator('.round-head')).toContainText('Runde 1 / 2 · Ziel 20');
  await expect(page.locator('.board-wrap g[data-n="20"] path.b-grey')).toHaveCount(0);
  await expect(page.locator('.board-wrap g[data-n="1"] path.b-grey').first()).toBeVisible();
  const points = (name: string) => page.locator('.score-card', { hasText: name }).locator('.score-rest');

  await turn(page, 'T20', 'S20'); // Gian 10 + 80 = 90
  await dart(page, '0');
  await dart(page, '0');
  await dart(page, '0'); // Jörn: kein Treffer → 10 / 2 = 5
  await expect(page.locator('.calc')).toHaveText('Halbiert: 10 → 5');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(points('Gian')).toHaveText('90');
  await expect(points('Jörn')).toHaveText('5');

  await expect(page.locator('.round-head')).toContainText('Ziel beliebiges Double');
  await expect(page.locator('.board-wrap path.b-grey')).toHaveCount(0); // alle Zahlen zählen
  await turn(page, 'D16'); // Gian 122
  await dart(page, 'T20');
  await dart(page, 'DB');
  await dart(page, '0'); // Jörn: Bullseye zählt als Double → 55

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(1)).toHaveText('122');
  await expect(end.locator('tr', { hasText: 'Jörn' }).locator('td').nth(1)).toHaveText('55');
  await expect(end.locator('tr', { hasText: 'Jörn' }).locator('td').nth(2)).toHaveText('1×');
});
