// Leg-Übersicht: Average je Spieler und Leg, während des Matches und am Spielende.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('Average je Leg in einem Match über 2 Legs', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  // 101 Double-Out, first to 2 Legs
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'frei' }).click();
  await page.locator('input[type=number]').fill('101');
  await page.getByRole('button', { name: 'Legs mehr' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  // Leg 1: Gian checkt in 3 Darts
  await turn(page, 'T20', 'S1', 'D20');

  // Leg 2 beginnt Jörn: Übersicht während des Matches
  await page.getByRole('button', { name: /Leg-Übersicht/ }).click();
  const live = page.getByRole('dialog', { name: 'Leg-Übersicht' });
  const leg1 = live.locator('tbody tr').first();
  await expect(leg1.locator('td').nth(1)).toContainText('101,00');
  await expect(leg1.locator('td').nth(1)).toContainText('✔ 3 Darts');
  await page.getByRole('button', { name: 'Schließen' }).click();

  await turn(page, 'S20', 'S20', 'S20'); // Jörn 60 in 3 Darts
  await dart(page, 'T20'); // Gian checkt wieder
  await dart(page, 'S1');
  await dart(page, 'D20');

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  const table = end.locator('.leg-overview');
  await expect(table.locator('tbody tr')).toHaveCount(3); // Leg 1, Leg 2, Match
  const row2 = table.locator('tbody tr').nth(1);
  await expect(row2.locator('td').nth(1)).toContainText('101,00');
  await expect(row2.locator('td').nth(2)).toContainText('60,00');
  const total = table.locator('tbody tr').nth(2);
  await expect(total).toContainText('Match');
  await expect(total.locator('td').nth(1)).toHaveText('101,00');
  await expect(total.locator('td').nth(2)).toHaveText('60,00');
});
