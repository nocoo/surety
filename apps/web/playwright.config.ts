import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const PORT = 27012;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: "./tests/playwright",
  globalSetup: "./tests/playwright/global-setup.ts",
  globalTeardown: "./tests/playwright/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: `bun run scripts/run-l3-server.ts`,
    cwd: REPO_ROOT,
    url: `${BASE_URL}/api/live`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { L3_PORT: String(PORT) },
    stdout: "pipe",
    stderr: "pipe",
  },

  projects: [
    {
      name: "chromium",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
