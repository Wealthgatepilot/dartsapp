// Computergegner am simulierten Handy (SPEC 9): auswählen, er wirft selbst, „Weiter“ tippt der Mensch.

import { expect, test } from '@playwright/test';
import { createProfiles, turn } from './helpers';

test('X01 gegen den Computer', async ({ page }) => {
  await createProfiles(page, 'Gian');
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Stufe mehr' }).click(); // Stufe 6
  await page.getByRole('button', { name: '+ Computer' }).click();
  await expect(page.locator('.order')).toContainText('Computer 6');
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const bot = page.locator('.block', { hasText: 'Computer 6' });
  await expect(bot.locator('.block-big')).toHaveText('501');
  await turn(page, 'T20', 'T20', 'T20'); // Gian 180

  // Jetzt wirft der Computer: Board und „Daneben“ sind gesperrt, seine Darts erscheinen nacheinander
  await expect(page.locator('.turn-head')).toContainText('Computer 6');
  await expect(page.getByRole('button', { name: 'Daneben', exact: true })).toBeDisabled();
  await expect(page.locator('.turnbox .pill')).toHaveCount(3, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Weiter →' })).toBeEnabled();
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(page.locator('.turn-head')).toContainText('Gian');
});

test('Ausbullen gegen den Computer: er wirft selbst', async ({ page }) => {
  await createProfiles(page, 'Gian');
  await page.goto('./#/cricket');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: '+ Computer' }).click();
  await page.getByRole('radio', { name: 'Ausbullen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  // Gian tippt seinen Punkt und bestätigt; danach wirft der Computer von selbst
  const box = (await page.locator('.bull-view').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + 10, box.y + box.height / 2);
  await page.getByRole('button', { name: /^Wurf bestätigen/ }).click();
  await expect(page.locator('.bull-tile', { hasText: 'Computer 5' })).toContainText('mm', { timeout: 10_000 });
});
