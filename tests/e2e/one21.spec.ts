// 121 am simulierten Handy (SPEC 7.7): Checkout-Vorschlag, Erfolg, Bust, Spielende.

import { expect, test } from '@playwright/test';
import { createProfiles, dart } from './helpers';

test('121 mit 2 Versuchen à 3 Darts', async ({ page }) => {
  await createProfiles(page, 'Gian');
  await page.goto('./');
  await page.getByRole('link', { name: /^121/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('radio', { name: '3', exact: true }).click();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Versuche weniger' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: 121' });
  await expect(rules).toContainText('Für jeden Versuch hast du 3 Darts (1 Aufnahme)');
  await expect(rules).toContainText('Jeder hat 2 Versuche');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const card = page.locator('.score-card');
  await expect(card.locator('.score-rest')).toHaveText('121');
  await expect(card).toContainText('Ziel 121 · Versuch 1/2');
  await expect(page.locator('.checkout-main')).toHaveText('T20 T15 D8'); // wie in der Checkout-Tabelle
  await expect(page.locator('.turnbox')).toContainText('noch 3 Darts im Versuch');

  await dart(page, 'T20');
  await dart(page, 'T11');
  await dart(page, 'D14'); // Checkout
  await expect(page.locator('.turnbox')).toContainText('Checkout 121!');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(card.locator('.score-rest')).toHaveText('122');
  await expect(card).toContainText('Ziel 122 · Versuch 2/2');

  await dart(page, 'T20');
  await dart(page, 'T20');
  await dart(page, 'S1'); // Rest 1 → Bust, letzter Versuch vorbei

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(1)).toHaveText('121');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(2)).toHaveText('1/2');
});
