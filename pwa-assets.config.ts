// Erzeugt die App-Symbole aus public/icon.svg (eigenes Motiv, keine fremden Marken).
// Aufruf: npx pwa-assets-generator
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#14181c' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#14181c' } },
  },
  images: ['public/icon.svg'],
});
