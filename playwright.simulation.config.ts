import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4182', viewport: { width: 1280, height: 900 }, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
  webServer: [
    { command: 'node tests/browser/server.mjs', url: 'http://127.0.0.1:4302/records', reuseExistingServer: false },
    { command: 'npm run dev -- --config tests/browser/vite.config.ts --host 127.0.0.1 --port 4182 --strictPort', url: 'http://127.0.0.1:4182', reuseExistingServer: false,
      env: { VITE_API_URL: 'http://127.0.0.1:4302/api', VITE_SOCKET_URL: 'http://127.0.0.1:4302/simulator' } },
  ],
});
