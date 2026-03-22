import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    ".next-e2e-ui/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright E2E tests (not React code):
    "e2e/**",
  ]),
  // tseslint strict — replaces manual rules
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
  // no-console for application code only (scripts use console legitimately)
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "mcp/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
]);

export default eslintConfig;
