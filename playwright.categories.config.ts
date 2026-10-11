import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: ['**/categories.spec.ts', '**/images.spec.ts'],
  grep: /.*/,
  testIgnore: [],
  webServer: {
    ...base.webServer,
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://categories.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-browser-test-only',
    },
  },
});
