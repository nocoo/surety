import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    globals: true,
    include: [
      "apps/*/src/__tests__/**/*.test.{ts,tsx}",
      "apps/*/__tests__/**/*.test.{ts,tsx}",
      "packages/*/src/__tests__/**/*.test.{ts,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/l2-http/**",
    ],
    coverage: {
      provider: "v8",
      experimentalAstAwareRemapping: true,
      include: [
        "apps/web/src/**",
        "apps/worker/src/**",
        "apps/cli/src/**",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "**/*.tsx",
        "**/__tests__/**",
        "**/index.ts",
        "**/types.ts",
        "**/e2e/**",
        "**/l2-http/**",
        // Worker HTTP routes — exercised by L2 (e2e + http) suites, not L1.
        "apps/worker/src/routes/**",
        // Worker middleware that depends on D1/Hono context — covered by L2.
        "apps/worker/src/middleware/db.ts",
        // Build-time stub for bun:sqlite, never executed at runtime.
        "apps/worker/src/lib/bun-sqlite-stub.ts",
        // CLI declarative CRUD wrappers — defineCrudCommand itself is L1-tested.
        "apps/cli/src/commands/assets.ts",
        "apps/cli/src/commands/doctors.ts",
        "apps/cli/src/commands/hospitals.ts",
        "apps/cli/src/commands/insurers.ts",
        "apps/cli/src/commands/medical-visits.ts",
        "apps/cli/src/commands/members.ts",
        // CLI interactive browser-login flow — verified manually.
        "apps/cli/src/commands/auth.ts",
        // Web hooks/lib that depend on browser APIs — L3 (Playwright) territory.
        "apps/web/src/hooks/**",
        "apps/web/src/lib/upload-with-progress.ts",
        "apps/web/src/lib/utils.ts",
        // Pure data / config modules — declarative, no behavior.
        "apps/web/src/lib/navigation.ts",
        "apps/web/src/lib/chart-config.ts",
        "apps/web/src/lib/constants/**",
        // View-model that drives chart rendering — verified via L3 browser tests.
        "apps/web/src/lib/dashboard-vm.ts",
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
