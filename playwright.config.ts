import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3001",
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
    command: "PORT=3001 npm run dev",
    url: "http://localhost:3001/api/health",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      PORT: "3001",
      NODE_ENV: "test",
      IS_E2E: "true",
      CORS_ORIGIN: "http://127.0.0.1:3001",
      E2E_PROCESSING_DELAY_MS: "3000",
      MAX_CONCURRENT_EXPORTS: "2",
      FFMPEG_TIMEOUT_SECONDS: "120",
      OUTPUT_TTL_MINUTES: "1",
    },
  },
});
