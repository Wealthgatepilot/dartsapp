// Installierbarkeit und Offline-Betrieb der gebauten App (SPEC 13.1).
// Läuft nur in Chromium: Der Service Worker lässt sich im WebKit von Playwright unter Windows nicht zuverlässig prüfen.

import { expect, test } from '@playwright/test';

const BUILT = 'http://localhost:4174/dartsapp/';

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Service Worker nur in Chromium geprüft');
});

test('Manifest macht die App installierbar', async ({ page }) => {
  await page.goto(BUILT);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await page.request.get(new URL(href!, BUILT).toString())).json();
  expect(manifest).toMatchObject({ name: 'Darts', display: 'standalone', start_url: '/dartsapp/', scope: '/dartsapp/' });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});

test('startet ohne Internet und behält die Daten', async ({ page, context }) => {
  await page.goto(BUILT + '#/profile');
  await page.getByPlaceholder('Name').fill('Offline-Test');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.locator('.list-row', { hasText: 'Offline-Test' })).toBeVisible();

  // Warten, bis der Service Worker alles zwischengespeichert hat und die Seite steuert.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.goto(BUILT + '#/profile');
  await expect(page.locator('.list-row', { hasText: 'Offline-Test' })).toBeVisible();
  await page.goto(BUILT + '#/x01');
  await expect(page.getByRole('button', { name: 'Spiel starten' })).toBeVisible();
  await context.setOffline(false);
});
