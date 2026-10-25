import { expect, test } from '@playwright/test';

test('Board ist sichtbar und groß genug', async ({ page }) => {
  await page.goto('./#/board-test');
  const box = await page.locator('svg.board').boundingBox();
  const vp = page.viewportSize()!;
  expect(box, 'Board wird gezeichnet').not.toBeNull();
  // Das Board soll mindestens 85 % der kürzeren Bildschirmseite nutzen.
  expect(box!.width).toBeGreaterThan(Math.min(vp.width, vp.height) * 0.85);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 0.5);
});

for (const [distance, expected] of [
  [20, 'S20 = 20'],
  [70, 'D20 = 40'],
  [110, 'T20 = 60'],
] as const) {
  test(`${distance} px Ziehen auf der 20 ergibt ${expected}`, async ({ page }) => {
    await page.goto('./#/board-test');
    const box = (await page.locator('svg.board').boundingBox())!;
    const cx = box.x + box.width / 2;
    const startY = box.y + box.height / 2 - 0.6 * (box.width / 2);
    await page.mouse.move(cx, startY);
    await page.mouse.down();
    const bar = (await page.locator('.ringbar').boundingBox())!;
    const dir = bar.y + bar.height <= startY ? { x: 0, y: -1 } : bar.x > cx ? { x: 1, y: 0 } : { x: -1, y: 0 };
    await page.mouse.move(cx + dir.x * distance, startY + dir.y * distance, { steps: 5 });
    await expect(page.locator('.preview')).toHaveText(expected);
    await page.mouse.up();
  });
}

test('Ziehen auf der 20 trägt T20 ein', async ({ page }) => {
  await page.goto('./#/board-test');
  const box = (await page.locator('svg.board').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const startY = cy - 0.6 * (box.width / 2);
  await page.mouse.move(cx, startY);
  await page.mouse.down();
  // Leiste liegt oben oder seitlich – wir ziehen in die Richtung, in der sie liegt.
  const bar = (await page.locator('.ringbar').boundingBox())!;
  const dir = bar.y + bar.height <= startY ? { x: 0, y: -1 } : bar.x > cx ? { x: 1, y: 0 } : { x: -1, y: 0 };
  await page.mouse.move(cx + dir.x * 110, startY + dir.y * 110, { steps: 5 });
  await expect(page.locator('.preview')).toHaveText('T20 = 60');
  await page.mouse.up();
  await expect(page.locator('.pill')).toHaveText(/T20 · 60/);
});
