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
        "apps/cli/**",
        "packages/api/src/**",
        "packages/db/src/**",
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
