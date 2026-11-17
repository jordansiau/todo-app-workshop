import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3210",
    timezoneId: "Asia/Singapore",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run seed:holidays && npm run start -- --port 3210",
    url: "http://localhost:3210/api/health",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_PATH: path.resolve("data/e2e.db"),
      JWT_SECRET: "automated-test-only-secret-not-for-production-7654321",
      RP_ID: "localhost",
      RP_ORIGIN: "http://localhost:3210",
      RP_NAME: "Todo Tests",
    },
  },
});
