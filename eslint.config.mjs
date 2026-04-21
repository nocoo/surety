import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  // Next.js rules scoped to apps/web only
  ...nextVitals.map((config) => ({
    ...config,
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
  })),
  ...nextTs.map((config) => ({
    ...config,
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
  })),
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/.next-e2e/**",
    "**/.next-e2e-ui/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    "**/e2e/**",
    "apps/worker/**",
  ]),
  // tseslint strict for all TS files
  ...tseslint.configs.strict.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  // Override: allow underscore-prefixed unused vars
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // no-console for application code (scripts use console legitimately)
  {
    files: [
      "apps/web/src/**/*.ts",
      "apps/web/src/**/*.tsx",
      "packages/api/src/**/*.ts",
      "packages/db/src/**/*.ts",
      "packages/mcp/src/**/*.ts",
    ],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
]);

export default eslintConfig;
