import { defineConfig } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:3002";

// Runs the browser export engine tests in Google Chrome (Playwright's bundled Chromium lacks H.264/AAC).
export default defineConfig({
  testDir: "./e2e/engine",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: ORIGIN,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 3002 --strictPort",
    url: `${ORIGIN}/e2e/harness/export.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
