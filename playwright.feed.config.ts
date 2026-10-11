import { defineConfig } from '@playwright/test';
import categories from './playwright.categories.config';
export default defineConfig({
  ...categories,
  testMatch: ['**/site.spec.ts', '**/metadata.spec.ts'],
  grep: /.*/,
  grepInvert: /honest setup|library detail|demo route/,
});
