// Spielverlauf und Favoriten am simulierten Handy (Wunsch Gianluca).

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('Spielverlauf: Spiel öffnen, Favorit setzen, filtern', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  // Ein kurzes Count-Up über 1 Runde
  await page.goto('./#/count-up');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Runden weniger' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await turn(page, 'T20', 'T20', 'S1');
  for (let i = 0; i < 3; i++) await dart(page, 'S5'); // letzte Aufnahme: Spielende ohne Weiter
  await page.getByRole('dialog', { name: 'Spielende' }).getByRole('button', { name: 'Fertig' }).click();

  // Startseite: Spiel in „Letzte Spiele“, Weg zum Spielverlauf
  await page.getByRole('link', { name: /Spielverlauf/ }).first().click();
  await expect(page.locator('.topbar h1')).toHaveText('Spielverlauf');
  await expect(page.getByText('1 Spiel')).toBeVisible();
  await page.locator('.game-row', { hasText: 'Count-Up' }).click();

  // Rückblick: Ergebnis, Kennzahlen, Aufnahmen
  await expect(page.locator('.review')).toContainText('🏆 Gian gewinnt');
  await expect(page.locator('.review-metrics')).toContainText('121');
  await expect(page.locator('.review-turns li').first()).toContainText('T20');
  await expect(page.locator('.board-wrap')).toHaveCount(0);

  // Favorit für Gian
  await page.getByRole('button', { name: 'Favorit von Gian' }).click();
  await expect(page.getByRole('button', { name: 'Favorit von Gian' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.topbar a').first().click(); // zurück zum Spielverlauf

  await page.getByRole('button', { name: '★ Favoriten' }).click();
  await expect(page.locator('.game-row')).toHaveCount(1);
  await expect(page.locator('.game-row')).toContainText('★ Count-Up');
  await page.getByLabel('Profil').selectOption({ label: 'Jörn' });
  await expect(page.getByText('Keine Spiele für diese Auswahl.')).toBeVisible();
  await page.getByLabel('Profil').selectOption({ label: 'Gian' });
  await expect(page.locator('.game-row')).toHaveCount(1);
});
