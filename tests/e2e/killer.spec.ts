// Killer am simulierten Handy (SPEC 7.6): Zahlen selbst wählen, Killer werden, Leben nehmen, Sieg.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('Killer mit selbst gewählten Zahlen', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./');
  await page.getByRole('link', { name: /Killer/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await expect(page.getByText('Killer braucht 2 bis 20 Spieler.')).toBeVisible();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'selbst wählen' }).click();
  await page.getByLabel('Zahl Gian').selectOption('20');
  await page.getByLabel('Zahl Jörn').selectOption('20');
  await expect(page.getByText('Jede Zahl darf nur einmal vergeben werden.')).toBeVisible();
  await page.getByLabel('Zahl Jörn').selectOption('5');
  await page.getByRole('button', { name: 'Leben weniger' }).click(); // 2 Leben
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: Killer' });
  await expect(rules).toContainText('Jeder startet mit 2 Leben');
  await expect(rules.locator('dt', { hasText: 'Trefferzone ganzes Segment' })).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.getByRole('button', { name: 'Bestleistung' })).toHaveCount(0);
  const card = (name: string) => page.locator('.score-card', { hasText: name });
  await expect(card('Gian').locator('.score-rest')).toHaveText('20');
  await expect(card('Jörn').locator('.score-rest')).toHaveText('5');
  // Noch kein Killer: nur die eigene Zahl ist farbig
  await expect(page.locator('.board-wrap g[data-n="20"] path.b-grey')).toHaveCount(0);
  await expect(page.locator('.board-wrap g[data-n="5"] path.b-grey').first()).toBeVisible();

  await dart(page, 'D20');
  await expect(page.locator('.turnbox')).toContainText('Gian ist Killer');
  await expect(page.locator('.board-wrap g[data-n="5"] path.b-grey')).toHaveCount(0);
  await dart(page, 'D5');
  await expect(card('Jörn')).toContainText('♥');
  await dart(page, '0');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');

  await turn(page, '0', '0', '0'); // Jörn
  await dart(page, 'D5'); // Jörn verliert das letzte Leben → Gian gewinnt sofort

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tr', { hasText: 'Jörn' }).locator('td').nth(2)).toHaveText('raus');
  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: 'Killer' })).toContainText('🏆 Gian');
});

test('Killer „selbst wählen“ mit Computer: er bekommt eine freie Zahl', async ({ page }) => {
  await createProfiles(page, 'Gian');
  await page.goto('./#/killer');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: '+ Computer' }).click();
  await page.getByRole('radio', { name: 'selbst wählen' }).click();
  await expect(page.getByLabel('Zahl Computer 5')).toHaveCount(0);
  await page.getByLabel('Zahl Gian').selectOption('20');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  const bot = Number(await page.locator('.score-card', { hasText: 'Computer 5' }).locator('.score-rest').innerText());
  expect(bot).toBeGreaterThanOrEqual(1);
  expect(bot).toBeLessThanOrEqual(19);
});
