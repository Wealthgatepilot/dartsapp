// Ein ganzes Shanghai-Spiel am simulierten Handy (SPEC 7.3): nur das Ziel farbig, Shanghai vermerkt, Sieger nach Punkten.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test('ganzes Shanghai-Spiel über 2 Runden', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./#/shanghai');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  // Startzahl 19, 2 Runden, Shanghai beendet das Spiel nicht
  for (let i = 0; i < 18; i++) await page.getByRole('button', { name: 'Startzahl mehr' }).click();
  await expect(page.getByLabel('Runden').locator('span')).toHaveText('3');
  await page.getByRole('button', { name: 'Runden weniger' }).click();
  await page.getByRole('radio', { name: 'nein' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  await expect(page.getByRole('dialog')).toContainText('Runde 1 hat das Ziel 19, danach geht es aufwärts bis 20');
  await expect(page.getByRole('dialog')).toContainText('Vorausgewählt ist „Weiterspielen“');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.locator('.round-head')).toContainText('Runde 1 / 2 · Ziel 19');
  await expect(page.locator('.board-wrap g[data-n="19"] path.b-grey')).toHaveCount(0);
  await expect(page.locator('.board-wrap g[data-n="20"] path.b-grey').first()).toBeVisible();

  const points = (name: string) => page.locator('.score-card', { hasText: name }).locator('.score-rest');

  await turn(page, 'T19', 'S19', '0'); // Gian 76
  await turn(page, 'S19'); // Jörn 19, Rest wird aufgefüllt
  await expect(points('Gian')).toHaveText('76');
  await expect(points('Jörn')).toHaveText('19');

  await expect(page.locator('.round-head')).toContainText('Runde 2 / 2 · Ziel 20');
  await dart(page, 'S20');
  await dart(page, 'D20');
  await dart(page, 'T20'); // Shanghai → Frage
  const question = page.getByRole('dialog', { name: 'Shanghai' });
  await expect(question).toContainText('Gian hat ein Shanghai geworfen');
  await expect(page.getByRole('button', { name: 'Weiter →' })).toBeDisabled();
  // Rückgängig in der Frage nimmt den Dart zurück; dann nochmal werfen
  await question.getByRole('button', { name: /Rückgängig/ }).click();
  await expect(question).toHaveCount(0);
  await dart(page, 'T20');
  await expect(question.getByRole('button', { name: 'Weiterspielen' })).toHaveClass(/btn-primary/);
  await question.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  // Rückgängig nach „Weiterspielen“ bringt sofort die Frage zurück
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(question).toContainText('Gian hat ein Shanghai geworfen');
  await question.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(points('Gian')).toHaveText('196');

  // Jörn, letzte Aufnahme: nach dem dritten Dart ist das Spiel entschieden (wie ein Checkout, ohne Weiter)
  for (let i = 0; i < 3; i++) await dart(page, '0');
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tr', { hasText: 'Gian' }).locator('td').nth(3)).toHaveText('ja');
  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: 'Shanghai' })).toContainText('🏆 Gian');
});
