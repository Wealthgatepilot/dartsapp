// Sprachausgabe am simulierten Handy (SPEC 10): Die Stimme wird abgefangen und mitgeschrieben.

import { expect, test } from '@playwright/test';
import { createProfiles, dart, turn } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    class FakeUtterance {
      text: string;
      lang = '';
      volume = 1;
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u: FakeUtterance) => {
          if (u.volume > 0) spoken.push(u.text);
        },
        cancel: () => undefined,
        getVoices: () => [],
      },
    });
  });
});

const spoken = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

test('X01: Punkte, „du brauchst“, Game Shot und Match; Lautsprecher-Knopf schaltet ab', async ({ page }) => {
  await createProfiles(page, 'Gian', 'Jörn');
  await page.goto('./#/x01');
  await page.getByRole('button', { name: 'Gian' }).click();
  await page.getByRole('button', { name: 'Jörn' }).click();
  await page.getByRole('radio', { name: 'frei' }).click();
  await page.locator('input[type=number]').fill('101');
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await turn(page, 'S20', 'S20', 'S1'); // Gian 41 → Rest 60; Jörn steht noch auf 101
  await expect.poll(() => spoken(page)).toEqual(['41. Jörn, du brauchst 101']);

  // Abschalten: nichts mehr ansagen
  await page.getByRole('button', { name: 'Sprachausgabe aus' }).click();
  await turn(page, '0', '0', '0');
  await page.getByRole('button', { name: 'Sprachausgabe an' }).click();

  await dart(page, 'S20');
  await dart(page, 'D20'); // Gian checkt 60 → Spielende
  await expect.poll(() => spoken(page)).toEqual(['41. Jörn, du brauchst 101', 'Game Shot und das Match. Gian gewinnt']);
});

test('Einstellungen: Sprachausgabe aus bleibt gemerkt', async ({ page }) => {
  await page.goto('./#/einstellungen');
  await page.getByRole('radiogroup', { name: 'Sprachausgabe' }).getByRole('radio', { name: 'aus' }).click();
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Sprachausgabe' }).getByRole('radio', { name: 'aus' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
