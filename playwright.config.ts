import { defineConfig } from "@playwright/test";

const E2E_ORIGIN = "http://127.0.0.1:3001";

// Runs the built app in Google Chrome under the production security headers (see vite.config.ts).
// Chrome is required because exports encode H.264, which Playwright's bundled Chromium cannot.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["engine/**"],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: E2E_ORIGIN,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx vite preview --host 127.0.0.1 --port 3001 --strictPort",
    url: E2E_ORIGIN,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
