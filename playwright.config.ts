import { defineConfig, devices } from '@playwright/test';

// Vier Handy-Varianten aus der SPEC: iPhone (WebKit = Safari-Technik) und Android (Chromium),
// jeweils Hoch- und Querformat. Die Tests laufen gegen den Entwicklungsserver,
// der Offline-Test gegen die gebaute App (nur dort gibt es den Service Worker).
export default defineConfig({
  testDir: 'tests/e2e',
  // Auf GitHub ein zweiter Versuch bei seltenen Zeitproblemen; der Bericht weist solche Tests als „flaky“ aus.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5174/dartsapp/',
  },
  webServer: [
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174/dartsapp/',
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && npx vite preview --port 4174 --strictPort',
      url: 'http://localhost:4174/dartsapp/',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  projects: [
    { name: 'iphone-hoch', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-quer', use: { ...devices['iPhone 13 landscape'] } },
    // Echtes Safari zeigt im Querformat Adressleiste und Ränder: deutlich weniger Höhe.
    { name: 'iphone-quer-eng', use: { ...devices['iPhone 13 landscape'], viewport: { width: 750, height: 300 } } },
    { name: 'android-hoch', use: { ...devices['Pixel 7'] } },
    { name: 'android-quer', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
