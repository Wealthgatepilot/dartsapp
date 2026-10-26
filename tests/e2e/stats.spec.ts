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
