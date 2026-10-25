// Ein ganzes Doppelfeld-Training am simulierten Handy (SPEC 7.4): Treffer/Falsch-Flächen, Auffüllen, Rückgängig, Ergebnis je Feld.

import { expect, test, type Page } from '@playwright/test';
import { createProfiles } from './helpers';

async function tap(page: Page, kind: 'hit' | 'miss') {
  const pills = page.locator('.turnbox .pill');
  const before = await pills.count();
  await page.locator(kind === 'hit' ? '.hm-hit' : '.hm-miss').click();
  await expect(pills).toHaveCount(before + 1);
}

async function next(page: Page) {
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
}

test('Training nur auf D16 und D20', async ({ page }) => {
  await createProfiles(page, 'Gian');
  await page.goto('./#/training');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Keine' }).click();
  await expect(page.getByText('Mindestens ein Ziel wählen.')).toBeVisible();
  await page.getByRole('button', { name: 'D16', exact: true }).click();
  await page.getByRole('button', { name: 'D20', exact: true }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.locator('.score-card')).toContainText('Ziel 1/2');
  await expect(page.locator('.hm-hit')).toHaveText(/^D(16|20)$/);
  await tap(page, 'miss');
  await tap(page, 'hit');
  await tap(page, 'hit');
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Gian gewinnt');
  await expect(end.locator('tbody tr')).toHaveCount(3); // Gesamt, D16, D20
  await expect(end.locator('tr', { hasText: 'Gesamt' })).toContainText('2/3');
});

test('ganzes Doppelfeld-Training bis zum Treffer', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  await page.goto('./#/training');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  await expect(page.getByRole('dialog')).toContainText('Beim Bull zählt nur das Bullseye');
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect(page.locator('.topbar h1')).toHaveText('Doppelfeld-Training');

  const card = (name: string) => page.locator('.score-card', { hasText: name });
  const firstTarget = await page.locator('.hm-hit').innerText();
  await expect(card('Gian').locator('.score-rest')).toHaveText(firstTarget);

  // Gian: Falsch, Rückgängig, dann Treffer → nächstes Ziel
  await tap(page, 'miss');
  await page.locator('.hm-undo').click();
  await expect(page.locator('.turnbox .pill')).toHaveCount(0);
  await tap(page, 'hit');
  await expect(page.locator('.hm-hit')).not.toHaveText(firstTarget);
  await next(page); // 2 Darts aufgefüllt als Falsch
  await expect(card('Gian')).toContainText('1 getroffen · 2 falsch · 3 Darts');

  // Jörn trifft alles, Gian trifft ab jetzt alles
  for (let r = 0; r < 7; r++) {
    for (let i = 0; i < 3; i++) await tap(page, 'hit'); // Jörn
    if (r < 6) await next(page);
    else break; // Jörn ist fertig (21 Treffer)
    for (let i = 0; i < 3; i++) await tap(page, 'hit'); // Gian
    await next(page);
  }
  await expect(card('Jörn')).toContainText('21 getroffen · 0 falsch · 21 Darts');
  await next(page);

  // Gian hat 1 + 18 = 19 Ziele, es fehlen 2
  await tap(page, 'hit');
  await tap(page, 'hit');
  const end = page.getByRole('dialog', { name: 'Spielende' });
  await expect(end).toContainText('Jörn gewinnt'); // 21 gegen 23 Darts
  await expect(end.locator('tr', { hasText: 'Gesamt' })).toContainText('21/23');
  await expect(end.locator('tr', { hasText: 'Gesamt' })).toContainText('21/21 · 100 %');
  await end.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.list-row', { hasText: 'Doppelfeld-Training' })).toContainText('🏆 Jörn');
});
