// Count-Up und Handicap am simulierten Handy (SPEC 7.10, 7.1), dazu die Varianten in der Regelansicht.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('ganzes Count-Up über 2 Runden', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./');
  await page.getByRole('link', { name: /Count-Up/ }).click();
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Runden weniger' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: Count-Up' });
  await expect(rules).toContainText('Gespielt werden 2 Runden');
  await expect(rules).toContainText('Alle Varianten im Überblick');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.locator('.round-head')).toContainText('Runde 1 / 2');
  const points = (name: string) => page.locator('.score-card', { hasText: name }).locator('.score-rest');
  await turn(page, 'T20', 'T20', 'T20'); // Gian 180
  await turn(page, 'S1', 'S1'); // Jörn 2, dritter Dart wird aufgefüllt
  await expect(points('Gian')).toHaveText('180');
  await expect(points('Jörn')).toHaveText('2');
  await expect(page.locator('.round-head')).toContainText('Runde 2 / 2');
  await turn(page, 'DB', '0', '0'); // Gian 230
  await dart(page, 'S5');
  await dart(page, 'S5');
  await dart(page, 'S5'); // Jörn 17 → Spielende ohne Weiter

  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(1)).toHaveText('230');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(2)).toHaveText('115,00');
  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: 'Count-Up' })).toContainText('🏆 Gian');
});

test('Handicap: eigener Startwert je Spieler', async ({ page }) => {
  await createProfiles(page, 'Gian', 'Jörn');
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radiogroup', { name: 'Handicap' }).getByRole('radio', { name: 'an' }).click();
  await page.getByLabel('Startwert Jörn').fill('301');
  await page.getByRole('button', { name: 'Regeln' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln: 501' });
  await expect(rules).toContainText('Jörn startet mit 301');
  await expect(rules).toContainText('Master-Out'); // Varianten zeigen alle Out-Arten
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const rest = (name: string) => page.locator('.score-card', { hasText: name }).locator('.score-rest');
  await expect(rest('Gian')).toHaveText('501');
  await expect(rest('Jörn')).toHaveText('301');
  await turn(page, 'T20', 'T20', 'T20');
  await turn(page, 'T20', 'T20', 'T20');
  await expect(rest('Gian')).toHaveText('321');
  await expect(rest('Jörn')).toHaveText('121');
});
