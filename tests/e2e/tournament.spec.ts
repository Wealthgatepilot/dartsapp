// Turnier am simulierten Handy (SPEC 8): anlegen, Partie spielen, Gleichstand mit Ausbullen, Computer-Partien automatisch.

import { expect, test, type Page } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

/** Tippt im vergrößerten Bull auf die Stelle (x, y) in mm und bestätigt den Wurf. */
async function bull(page: Page, xMm: number, yMm: number) {
  await page.locator('.bull-view').scrollIntoViewIfNeeded();
  const box = (await page.locator('.bull-view').boundingBox())!;
  await page.mouse.click(box.x + ((xMm + 45) / 90) * box.width, box.y + ((yMm + 45) / 90) * box.height);
  await page.getByRole('button', { name: /^Wurf bestätigen/ }).click();
}

test('K.-o.-Turnier Count-Up: Gleichstand im Finale, Ausbullen entscheidet', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./');
  await page.getByRole('link', { name: /Turnier/ }).first().click();
  await page.getByRole('link', { name: '+ Neues Turnier' }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'Count-Up' }).click();
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Runden weniger' }).click();
  await page.getByRole('radio', { name: 'wie eingetragen' }).click();
  await page.getByRole('button', { name: 'Turnier starten' }).click();

  await expect(page.locator('.match-row', { hasText: 'Finale' })).toBeVisible();
  await page.getByRole('button', { name: 'Spielen' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Count-Up · 1 Runde');

  // Beide werfen 180 → Gleichstand
  await turn(page, 'T20', 'T20', 'T20');
  await dart(page, 'T20');
  await dart(page, 'T20');
  await dart(page, 'T20');
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gleichstand');
  await expect(end.getByRole('button', { name: 'Revanche' })).toHaveCount(0);
  await end.getByRole('button', { name: 'Zum Turnier' }).click();

  await page.getByRole('button', { name: 'Ausbullen' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Stechen: Ausbullen');
  const first = (await page.locator('.bull-hint').innerText()).includes('Gian') ? 'Gian' : 'Jörn';
  const second = first === 'Gian' ? 'Jörn' : 'Gian';
  await bull(page, 20, 0); // erster weit weg
  await bull(page, 3, 0); // zweiter im Bullseye
  await page.getByRole('button', { name: /^Ergebnis übernehmen/ }).click();

  await expect(page.locator('.card-accent')).toContainText(`${second} gewinnt das Turnier`);
  await expect(page.locator('.bracket-side.won')).toContainText(second);
  expect(first).not.toBe(second);
});

test('Turnier nur mit Computern spielt sich selbst aus', async ({ page }) => {
  await page.goto('./#/turnier/neu');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+ Computer' }).click();
  await expect(page.locator('.order li')).toHaveCount(4);
  await page.getByRole('radio', { name: 'Jeder gegen jeden' }).click();
  await page.getByRole('button', { name: 'Turnier starten' }).click();
  await expect(page.locator('.card-accent')).toContainText('gewinnt das Turnier', { timeout: 30000 });
  await expect(page.locator('.standings tbody tr')).toHaveCount(4);
  // Jeder hat 3 Partien gespielt, zusammen 12 Punkte
  for (const row of await page.locator('.standings tbody tr').all()) await expect(row.locator('td').nth(2)).toHaveText('3');
});
