// Ein ganzes Leg 501 Double-Out am simulierten Handy (ROADMAP: „Ein automatisierter Durchlauf
// in Handygröße spielt ein ganzes Leg“), mit Bust, Rückgängig, Neuladen und Runde bearbeiten.

import { expect, test, type Page } from '@playwright/test';
import { createProfiles, dart, throwOn, turn } from './helpers';

const rest = (page: Page, name: string) =>
  page.locator('.score-card', { hasText: name }).locator('.score-rest');

test('ganzes Leg 501 Double-Out mit Bust, Rückgängig, Neuladen und Runde bearbeiten', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  await createProfiles(page, 'Gian', 'Jörn');

  // Spiel einrichten: 501, Single-In, Double-Out, 1 Leg (Standard)
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('501 · Double-Out');

  await turn(page, 'T20', 'T20', 'T20'); // Gian 321
  await turn(page, '0', '0', '0'); // Jörn 501
  await turn(page, 'T20', 'T20', 'T20'); // Gian 141
  await expect(rest(page, 'Gian')).toHaveText('141');

  // Jörn: ein falscher Dart, Rückgängig, dann richtig
  await dart(page, 'S1');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.locator('.turnbox .pill')).toHaveCount(0);
  await turn(page, 'S20', 'S20', 'S20'); // Jörn 441
  await expect(rest(page, 'Jörn')).toHaveText('441');

  // Neuladen mitten im Spiel: Stand muss erhalten bleiben
  await page.reload();
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Fortsetzen' }).click();
  await expect(rest(page, 'Gian')).toHaveText('141');
  await expect(page.locator('.checkout-main')).toHaveText('T20 T19 D12');

  // Gian überwirft: 141 − 60 − 60 = 21, T20 → Bust
  await dart(page, 'T20');
  await dart(page, 'T20');
  await dart(page, 'T20');
  await expect(page.locator('.calc')).toContainText('BUST');
  await expect(rest(page, 'Gian')).toHaveText('141');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');

  await turn(page, 'S20', 'S20', 'S20'); // Jörn 381

  // Runde bearbeiten: Jörns zweite Aufnahme, erster Dart war T20 statt S20 → 341
  await page.getByRole('button', { name: '✎ Runden' }).click();
  await page.locator('.modal .list-button', { hasText: 'R2' }).filter({ hasText: 'Jörn' }).click();
  await page.locator('.modal .pill-main').first().click();
  await throwOn(page, page.locator('.modal svg.board'), 'T20');
  await expect(page.locator('.modal .pill-main').first()).toHaveText('T20 · 60');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(rest(page, 'Jörn')).toHaveText('341');

  // Gian checkt 141: T20 T19 D12
  await dart(page, 'T20');
  await dart(page, 'T19');
  await dart(page, 'D12');
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  const gian = end.locator('.match-table tr', { hasText: 'Gian' });
  // 501 Punkte in 12 Darts (Bust-Aufnahme zählt 3 Darts) = 125,25; höchster Checkout 141
  await expect(gian).toContainText('125,25');
  await expect(gian.locator('td').nth(3)).toHaveText('12');
  await expect(gian.locator('td').nth(4)).toHaveText('141');
  // Aufnahmen im Match: zwei 180er, eine 141 (140+); Spalten 80+, 100+, 120+, 140+, 160+, 180
  const counts = end.locator('.match-counts tr', { hasText: 'Gian' }).locator('td');
  await expect(counts).toHaveText(['Gian', '0', '0', '0', '1', '0', '2']);

  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: '🏆 Gian' })).toBeVisible();
});
