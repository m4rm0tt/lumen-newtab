/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // MV3 interdit les scripts inline : pas de polyfill injecté dans le HTML.
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: { newtab: resolve(import.meta.dirname, 'newtab.html') },
    },
  },
  server: { open: '/newtab.html' },
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
