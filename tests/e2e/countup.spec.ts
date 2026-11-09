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
  const points = (name: string) => page.locator('.block', { hasText: name }).locator('.block-big');
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
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(8)).toHaveText('1'); // eine 180
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

  const rest = (name: string) => page.locator('.block', { hasText: name }).locator('.block-big');
  await expect(rest('Gian')).toHaveText('501');
  await expect(rest('Jörn')).toHaveText('301');
  await turn(page, 'T20', 'T20', 'T20');
  await turn(page, 'T20', 'T20', 'T20');
  await expect(rest('Gian')).toHaveText('321');
  await expect(rest('Jörn')).toHaveText('121');
});

test('Count-Up mit Zeit: Uhr, Pause, Zeit um, Runde zu Ende; zusammen als Team', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T18:00:00') });
  await createProfiles(page, 'Gian', 'Jörn');
  await page.goto('./#/count-up');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'wie eingetragen' }).click();
  await page.getByRole('radio', { name: 'Zeit' }).click();
  for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Minuten weniger' }).click(); // 5 Minuten
  await page.getByRole('radio', { name: 'zusammen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Count-Up · 5 Min · zusammen');

  const timer = page.locator('.cu-timer');
  await expect(timer).toContainText('5:00');
  await expect(timer).toContainText('startet mit dem ersten Dart');
  await turn(page, 'T20', 'T20', 'T20'); // Gian 180, Uhr läuft
  await page.clock.fastForward('02:00');
  await expect(timer).toContainText(/3:00|2:5\d/); // echte Sekunden laufen zwischen den Schritten weiter

  // Pause hält die Uhr an
  await page.getByRole('button', { name: '⏸ Pause' }).click();
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause).toBeVisible();
  await page.clock.fastForward('10:00');
  await expect(pause).toContainText(/Noch (3:00|2:5\d)/);
  await pause.getByRole('button', { name: 'Weiter' }).click();

  // Jörn wirft, dann ist die Zeit um, während Gian in Runde 2 wirft → Jörn darf Runde 2 noch werfen
  await turn(page, 'S20', 'S5'); // Jörn 25
  await dart(page, 'S1'); // Gian
  await page.clock.fastForward('03:05');
  await expect(timer).toContainText('Zeit um');
  await turn(page, 'S1', 'S1'); // Gian 183
  await expect(page.locator('.cu-team')).toContainText('Team 208 Punkte');
  for (const f of ['S2', 'S2', 'S2']) await dart(page, f); // Jörn 31 → Schluss ohne Weiter
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Team: 214 Punkte');
  await expect(end.locator('tr', { hasText: 'Team' })).toContainText('214');
});
