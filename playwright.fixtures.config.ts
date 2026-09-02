import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/fixtures",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:3100", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: "DATA_MODE=fixtures ALLOW_EXTERNAL_CALLS=false ENABLE_RUNTIME_LLM=false npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
});
