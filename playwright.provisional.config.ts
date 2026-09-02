import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/provisional",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:3200", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: "DATA_MODE=provisional ALLOW_EXTERNAL_CALLS=false ENABLE_RUNTIME_LLM=false npm run start -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
  },
});
