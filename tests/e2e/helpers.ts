// Gemeinsame Helfer der Handy-Tests: Profile anlegen, Darts über das Board werfen, Aufnahmen beenden.

import { expect, type Locator, type Page } from '@playwright/test';

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const DRAG = [20, 70, 110]; // Zugweite für S, D, T (SPEC 4.3: Stufen alle 50 Punkte)

/** Wirft einen Dart über das Board: Segment halten, zur Leiste ziehen, loslassen. */
export async function throwOn(page: Page, board: Locator, field: string) {
  const m = field === 'DB' ? 2 : field === 'SB' ? 1 : 'SDT'.indexOf(field[0]) + 1;
  const n = field.endsWith('B') ? 25 : Number(field.slice(1));
  const box = (await board.boundingBox())!;
  const R = box.width / 2;
  const cx = box.x + R;
  const cy = box.y + R;
  const a = (ORDER.indexOf(n) * 18 * Math.PI) / 180;
  const x = n === 25 ? cx : cx + Math.sin(a) * 0.6 * R;
  const y = n === 25 ? cy : cy - Math.cos(a) * 0.6 * R;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const bar = (await page.locator('.ringbar').boundingBox())!;
  const d = DRAG[m - 1];
  const [dx, dy] = bar.y + bar.height <= y ? [0, -d] : bar.x > x ? [d, 0] : [-d, 0];
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

/** Ein Dart in der Spielansicht; „0“ = Daneben. Wartet, bis die Pill erscheint. */
export async function dart(page: Page, field: string) {
  const pills = page.locator('.turnbox .pill');
  const before = await pills.count();
  if (field === '0') {
    // Während die App den vorigen Dart noch speichert, ignoriert sie Tipps (kein Doppel-Tipp).
    // Kommt der Tipp in diesem Augenblick, wird er wiederholt.
    await expect(async () => {
      if ((await pills.count()) === before) await page.getByRole('button', { name: 'Daneben', exact: true }).click();
      await expect(pills).toHaveCount(before + 1, { timeout: 1000 });
    }).toPass();
    return;
  }
  await throwOn(page, page.locator('.board-wrap svg.board'), field);
  await expect(pills).toHaveCount(before + 1);
}

/** Eine Aufnahme werfen und „Weiter“ tippen. */
export async function turn(page: Page, ...fields: string[]) {
  for (const f of fields) await dart(page, f);
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.locator('.turnbox')).toContainText('Noch kein Dart');
}

export async function createProfiles(page: Page, ...names: string[]) {
  await page.goto('./#/profile');
  for (const name of names) {
    await page.getByPlaceholder('Name').fill(name);
    await page.getByRole('button', { name: 'Anlegen' }).click();
    await expect(page.locator('.list-row', { hasText: name })).toBeVisible();
  }
}
