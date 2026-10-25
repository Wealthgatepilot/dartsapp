/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import pkg from './package.json' with { type: 'json' };

// base: Die App liegt auf GitHub Pages unter https://wealthgatepilot.github.io/dartsapp/
export default defineConfig({
  base: '/dartsapp/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
