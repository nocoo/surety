import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  // Next.js rules scoped to apps/web_legacy only
  ...nextVitals.map((config) => ({
    ...config,
    files: ["apps/web_legacy/**/*.ts", "apps/web_legacy/**/*.tsx"],
  })),
  ...nextTs.map((config) => ({
    ...config,
    files: ["apps/web_legacy/**/*.ts", "apps/web_legacy/**/*.tsx"],
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
      "apps/web_legacy/src/**/*.ts",
      "apps/web_legacy/src/**/*.tsx",
      "packages/api/src/**/*.ts",
      "packages/db/src/**/*.ts",
    ],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Forbid focused/skipped tests — every test must run
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='skip']",
          message: "*.skip is not allowed — every test must run.",
        },
        {
          selector:
            "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='only']",
          message: "*.only is not allowed — it silently skips other tests.",
        },
      ],
    },
  },
]);

export default eslintConfig;
