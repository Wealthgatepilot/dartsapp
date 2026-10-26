// Bestleistungs-Vergleich im laufenden Spiel (SPEC 12).

import { expect, test } from '@playwright/test';
import { createProfiles, dart } from './helpers';

test('Bestleistung: nach gleich vielen Darts und Endwerte', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await createProfiles(page, 'Gian', 'Jörn');

  // Spiel 1 (Rekord): 101 Double-Out, Gian checkt mit T20 S1 D20 in 3 Darts → Average 101
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'frei' }).click();
  await page.locator('input[type=number]').fill('101');
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  // Vor dem ersten beendeten Leg gibt es keinen Rekord
  await page.getByRole('button', { name: 'Bestleistung' }).click();
  await expect(page.getByRole('dialog', { name: 'Bestleistung' })).toContainText('Noch keine Bestleistung');
  await page.getByRole('button', { name: 'Schließen' }).click();

  await dart(page, 'T20');
  await dart(page, 'S1');
  await dart(page, 'D20');
  await page.getByRole('dialog', { name: 'Spielende' }).getByRole('button', { name: 'Revanche' }).click();

  // Spiel 2: drei Darts S20 → Average 60
  // Warten, bis die Revanche wirklich offen ist (WebKit braucht dafür einen Moment)
  await expect(page.getByRole('dialog', { name: 'Spielende' })).toHaveCount(0);
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
  await expect(page.locator('.turnbox .turn-head')).toContainText('Gian');
  await dart(page, 'S20');
  await dart(page, 'S20');
  await dart(page, 'S20');
  await page.getByRole('button', { name: 'Bestleistung' }).click();
  const dlg = page.getByRole('dialog', { name: 'Bestleistung' });
  await expect(dlg).toContainText('Gian · 101 · S-In · D-Out · 3 Darts in diesem Leg');

  const tables = dlg.locator('table');
  const avgSame = tables.nth(0).locator('tr', { hasText: '3-Dart-Average' });
  await expect(avgSame).toContainText('60,00');
  await expect(avgSame).toContainText('101,00');
  await expect(avgSame.locator('.dev-bad')).toContainText('−40,6 %');

  const avgEnd = tables.nth(1).locator('tr', { hasText: '3-Dart-Average' });
  await expect(avgEnd.locator('.dev-bad')).toContainText('−40,6 %');
  const finish = tables.nth(1).locator('tr', { hasText: 'Darts bis zum Finish' });
  await expect(finish).toContainText('3');
  await expect(tables.nth(0).locator('tr', { hasText: 'Darts bis zum Finish' })).toContainText('erst am Ende');
});
