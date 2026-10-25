/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base: Die App liegt auf GitHub Pages unter https://wealthgatepilot.github.io/dartsapp/
export default defineConfig({
  base: '/dartsapp/',
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
