// Aussehen (SPEC 5.6) und Spielerblöcke (SPEC 5.3): Farbsatz umschalten, zweite Kennzahl-Seite, Rand des aktiven Spielers.

import { expect, test } from '@playwright/test';
import { createProfiles, turn } from './helpers';

test('Aussehen: Kreidegrau ist Standard, Dunkel bleibt nach dem Neuladen', async ({ page }) => {
  await page.goto('./#/einstellungen');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dunkel');
  await page.getByRole('radio', { name: 'Dunkel' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dunkel');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dunkel');
  await page.getByRole('radio', { name: 'Kreidegrau' }).click();
  await expect(html).not.toHaveAttribute('data-theme', 'dunkel');
});

test('X01: Spielerblöcke mit Legs, Kennzahlen und zweiter Seite', async ({ page }) => {
  await createProfiles(page, 'Gian', 'Jörn');
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  const gian = page.locator('.block', { hasText: 'Gian' });
  const joern = page.locator('.block', { hasText: 'Jörn' });
  await expect(gian).toHaveClass(/active/);
  await expect(joern).not.toHaveClass(/active/);
  await expect(gian.locator('.block-badge')).toHaveText('0');

  await turn(page, 'T20', 'T20', 'T20');
  await expect(gian.locator('.block-big')).toHaveText('321');
  await expect(joern).toHaveClass(/active/);

  // Handy quer: Blöcke als schmale Zeilen ohne Kennzahlen (SPEC 5.3)
  if (page.viewportSize()!.height < 500) {
    await expect(gian.locator('.block-stats')).toBeHidden();
    return;
  }
  await expect(gian.locator('.block-stat', { hasText: 'Letzte Aufnahme' })).toContainText('180');

  // Antippen der Kennzahlen blättert alle Blöcke auf Seite 2
  await gian.locator('.block-stats').click();
  await expect(gian.locator('.block-stat', { hasText: 'First 9' })).toContainText('180,00');
  await expect(joern.locator('.block-stat', { hasText: 'First 9' })).toBeVisible();
});
