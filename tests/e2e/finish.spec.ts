// 121 in der neuen Form am simulierten Handy: zufällige Zahl, Checkout nach Vorschlag, Überspringen, Spielende.

import { expect, test } from '@playwright/test';
import { createProfiles, dart } from './helpers';

test('121: Zahl auschecken, nächste überspringen', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian');
  await page.goto('./');
  await page.getByRole('link', { name: /^121/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Runden weniger' }).click(); // 2 Runden
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: 121' });
  await expect(rules).toContainText('Gespielt werden 2 Runden');
  await expect(rules).toContainText('unter 100 hast du je Versuch 6 Darts');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const card = page.locator('.score-card');
  await expect(card).toContainText('Runde 1/2 · Versuch 1');
  const rest = Number(await card.locator('.score-rest').innerText());
  expect(rest).toBeGreaterThanOrEqual(70);
  expect(rest).toBeLessThanOrEqual(170);
  await expect(page.locator('.turnbox')).toContainText(`noch ${rest < 100 ? 6 : 9} Darts im Versuch`);

  // Den angezeigten Checkout-Weg werfen
  const plan = (await page.locator('.checkout-main').innerText()).split(' ');
  for (const f of plan) await dart(page, f);
  await expect(page.locator('.turnbox')).toContainText(`Geschafft: ${rest}!`);
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(card).toContainText('Runde 2/2');
  await expect(card).toContainText('1 geschafft');

  // Zweite Zahl überspringen → Spielende
  await page.getByRole('button', { name: 'Überspringen' }).click();
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tbody tr').first()).toContainText('1/2');
  await expect(end.locator('.finish-rounds')).toContainText('übersprungen');
});
