import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests",
  outputDir: "../generated-artifacts/session-recovery",
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:80",
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: process.env.TEST_CHROMIUM_PATH,
      args: ["--no-sandbox"],
    },
  },
});
