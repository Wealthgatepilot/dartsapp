// Wer beginnt (SPEC 6.3, 6.4): Ausbullen mit Gleichstand und Münzwurf am simulierten Handy.

import { expect, test, type Page } from '@playwright/test';
import { createProfiles } from './helpers';

/** Tippt im vergrößerten Bull auf die Stelle (x, y) in mm und bestätigt den Wurf. */
async function bull(page: Page, xMm: number, yMm: number, expectLabel: RegExp) {
  const box = (await page.locator('.bull-view').boundingBox())!;
  const x = box.x + ((xMm + 45) / 90) * box.width;
  const y = box.y + ((yMm + 45) / 90) * box.height;
  await page.mouse.click(x, y);
  const confirm = page.getByRole('button', { name: /^Wurf bestätigen/ });
  await expect(confirm).toContainText(expectLabel);
  await confirm.click();
}

async function setupX01(page: Page, start: 'Ausbullen' | 'Münzwurf') {
  await createProfiles(page, 'Gian', 'Jörn');
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: start }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Wer wirft zuerst?');
}

test('Ausbullen mit Gleichstand: nur die Gleichen werfen erneut', async ({ page }) => {
  await setupX01(page, 'Ausbullen');
  await expect(page.locator('.bull-hint')).toContainText('Gian');
  await bull(page, 20, 0, /mm vom Bull/);
  await expect(page.locator('.bull-hint')).toContainText('Jörn');
  await bull(page, 20, 0, /mm vom Bull/); // dieselbe Stelle → exakt gleich weit

  // exakt gleich weit → beide noch einmal
  await expect(page.locator('.bull-hint')).toContainText('Gleich weit: Gian und Jörn werfen noch einmal.');
  await bull(page, 12, 0, /Single-Bull/);
  await bull(page, 3, 0, /Bullseye/);

  await expect(page.locator('.ranking li')).toHaveText(['Jörn', 'Gian']);
  await expect(page.locator('.bull-tile', { hasText: 'Jörn' })).toContainText('👑');
  await page.getByRole('button', { name: /^Spiel anfangen/ }).click();
  await expect(page.locator('.topbar h1')).toHaveText('501 · Double-Out');
  await expect(page.locator('.turnbox .turn-head')).toContainText('Jörn');
});

test('Ausbullen: Rückgängig und „Erneut werfen“', async ({ page }) => {
  await setupX01(page, 'Ausbullen');
  await bull(page, 30, 0, /mm vom Bull/);
  await page.getByRole('button', { name: '↶' }).click();
  await expect(page.locator('.bull-hint')).toContainText('Gian');
  await bull(page, 30, 0, /mm vom Bull/);
  await bull(page, 10, 0, /Single-Bull/);
  await page.getByRole('button', { name: 'Countdown anhalten' }).click();
  await page.getByRole('button', { name: 'Erneut werfen' }).click();
  await expect(page.locator('.bull-hint')).toContainText('Gian');
  await expect(page.locator('.bull-tile', { hasText: 'Gian' })).toContainText('wirft');
});

test('Ausbullen: hinein- und herauszoomen (SPEC 6.4, Punkt 2)', async ({ page }) => {
  await setupX01(page, 'Ausbullen');
  const view = page.locator('.bull-view');
  await expect(view).toHaveAttribute('viewBox', '-45 -45 90 90');

  // Herauszoomen bis zum ganzen Board
  const minus = page.getByRole('button', { name: 'Verkleinern' });
  while (await minus.isEnabled()) await minus.click();
  await expect(view).toHaveAttribute('viewBox', '-190 -190 380 380');

  // Ein Dart weit außen: Triple-Ring der 20 (etwa 103 mm über der Mitte)
  const box = (await view.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - (103 / 380) * box.height);
  await expect(page.getByRole('button', { name: /^Wurf bestätigen/ })).toContainText(/10\d,\d mm vom Bull/);

  // Doppeltipp vergrößert, „Bull“ springt zurück
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  const width = Number((await view.getAttribute('viewBox'))!.split(' ')[2]);
  expect(width).toBeLessThan(380);
  await page.getByRole('button', { name: 'Bull', exact: true }).click();
  await expect(view).toHaveAttribute('viewBox', '-45 -45 90 90');
  await page.getByRole('button', { name: 'Vergrößern' }).click();
  expect(Number((await view.getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(90);
});

test('Münzwurf legt fest, wer beginnt', async ({ page }) => {
  await setupX01(page, 'Münzwurf');
  await page.getByRole('button', { name: /Münze werfen/ }).click();
  const result = page.locator('.coin-result');
  await expect(result).toContainText('beginnt');
  const first = (await result.locator('strong').innerText()).trim();
  await page.getByRole('button', { name: 'Spiel anfangen' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('501 · Double-Out');
  await expect(page.locator('.turnbox .turn-head')).toContainText(first);
});
