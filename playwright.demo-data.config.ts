import { defineConfig } from "@playwright/test";

const experimentalArgs = [
  "--enable-experimental-web-platform-features",
  "--enable-features=WebMCP",
];

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "demo-data-chat.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: "list",
  outputDir: "../tmp/demo-data-chat/t0/playwright",
  use: {
    baseURL: "http://localhost:5173",
    locale: "vi-VN",
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-default", use: { browserName: "chromium" } },
    {
      name: "chromium-experimental",
      use: {
        browserName: "chromium",
        launchOptions: { args: experimentalArgs },
      },
    },
    {
      name: "edge-default",
      use: { browserName: "chromium", channel: "msedge" },
    },
    {
      name: "edge-experimental",
      use: {
        browserName: "chromium",
        channel: "msedge",
        launchOptions: { args: experimentalArgs },
      },
    },
  ],
});
