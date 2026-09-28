import { defineConfig } from "@playwright/test";

if (process.env.SURETY_E2E_OWNED !== "true" || !process.env.L3_PORT)
	throw new Error("Use bun run test:e2e:browser; an owned E2E runtime is required");
const PORT = Number(process.env.L3_PORT);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: "./tests/playwright",
	outputDir: process.env.SURETY_TEST_OUTPUT ?? "test-results",
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
		extraHTTPHeaders: { Origin: BASE_URL },
		trace: "on-first-retry",
		screenshot: "only-on-failure",
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
