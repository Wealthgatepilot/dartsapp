/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// base: Die App liegt auf GitHub Pages unter https://wealthgatepilot.github.io/dartsapp/
export default defineConfig({
  base: '/dartsapp/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preact(),
    // Installierbar und offline (SPEC 13.1, 13.2). „prompt“: Eine neue Version wird erst aktiv,
    // wenn Gianluca zwischen zwei Spielen auf „Neu laden“ tippt – nie mitten im Spiel.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        // Fester Ausweis der App: Android erkennt sie daran, auch wenn sich start_url später ändert.
        // Entspricht dem bisherigen Standardwert, bestehende Installationen bleiben also gültig.
        id: '/dartsapp/',
        name: 'Darts',
        short_name: 'Darts',
        description: 'Darts-Scorer für Familie und Freunde',
        lang: 'de',
        start_url: '/dartsapp/',
        scope: '/dartsapp/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#c4c1b8',
        theme_color: '#c4c1b8',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/dartsapp/index.html',
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
