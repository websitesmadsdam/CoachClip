import { defineConfig, devices } from "@playwright/test";

const E2E_ORIGIN = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "PORT=3001 npm run dev > e2e-server.log 2>&1",
    url: `${E2E_ORIGIN}/api/ready`,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      PORT: "3001",
      NODE_ENV: "test",
      IS_E2E: "true",
      E2E_TEST_MODE: "true",
      CORS_ORIGIN: E2E_ORIGIN,
      E2E_PROCESSING_DELAY_MS: "3000",
      MAX_CONCURRENT_EXPORTS: "2",
      FFMPEG_TIMEOUT_SECONDS: "120",
      OUTPUT_TTL_MINUTES: "1",
      RATE_LIMIT_EXPORT_CREATE: "50",
      RATE_LIMIT_EXPORT_CREATE_WINDOW_SECONDS: "60",
      RATE_LIMIT_STATUS: "1000",
      RATE_LIMIT_STATUS_WINDOW_SECONDS: "60",
      RATE_LIMIT_DOWNLOAD: "100",
      RATE_LIMIT_DOWNLOAD_WINDOW_SECONDS: "60",
    },
  },
});
