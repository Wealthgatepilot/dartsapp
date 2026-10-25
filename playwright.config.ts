import { defineConfig, devices } from '@playwright/test';

// Vier Handy-Varianten aus der SPEC: iPhone (WebKit = Safari-Technik) und Android (Chromium),
// jeweils Hoch- und Querformat.
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:5174/dartsapp/',
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/dartsapp/',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'iphone-hoch', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-quer', use: { ...devices['iPhone 13 landscape'] } },
    // Echtes Safari zeigt im Querformat Adressleiste und Ränder: deutlich weniger Höhe.
    { name: 'iphone-quer-eng', use: { ...devices['iPhone 13 landscape'], viewport: { width: 750, height: 300 } } },
    { name: 'android-hoch', use: { ...devices['Pixel 7'] } },
    { name: 'android-quer', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
