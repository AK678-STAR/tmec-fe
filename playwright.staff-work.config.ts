import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['staff-work.spec.ts', 'vet-admissions.spec.ts'],
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4318', locale: 'vi-VN', viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4318 --strictPort', url: 'http://127.0.0.1:4318', reuseExistingServer: false, timeout: 30000 },
});
