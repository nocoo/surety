#!/usr/bin/env bun
/**
 * Coverage gate — delegates to vitest (same runner as pre-commit L1).
 *
 * Historically this script spawned `bun test --coverage` per app, which
 * cannot execute Vitest-only suites and reported misleading failures after
 * the vitest migration. Now it is a thin wrapper around
 * `vitest run --coverage`, whose thresholds live in vitest.config.ts
 * (statements/branches/functions/lines ≥ 95.5).
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");

console.log("🧪 Coverage gate via vitest (thresholds in vitest.config.ts)\n");

const proc = spawnSync("bunx", ["vitest", "run", "--coverage"], {
	cwd: REPO_ROOT,
	stdio: "inherit",
});

if (proc.status !== 0) {
	console.error("\n❌ Coverage gate failed");
	process.exit(proc.status ?? 1);
}

console.log("\n✅ Coverage gate passed");
