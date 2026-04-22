import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
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
