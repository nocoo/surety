#!/usr/bin/env bun
/**
 * Benchmark the "test" step inside pre-commit.
 *
 * Measures three modes:
 *   - l1_miss_ms: run-l1.ts wall when cache is invalid (real test execution)
 *   - l1_hit_ms : run-l1.ts wall when cache is valid (just hashing)
 *   - precommit_wall_ms: full pre-commit.ts wall (parallel max of all 4 steps),
 *     measured with both caches warm so we capture lint-staged/gitleaks overhead.
 *
 * Primary metric exposed to autoresearch: l1_miss_ms (the meaningful work).
 *
 * Usage: bun run scripts/bench-pre-commit.ts [--trials=N]
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const TRIALS = Number(process.argv.find((a) => a.startsWith("--trials="))?.split("=")[1] ?? 7);

function gitCommonDir(): string {
	const r = spawnSync("git", ["rev-parse", "--git-common-dir"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return resolve(REPO_ROOT, r.stdout.trim());
}

const L1_CACHE = join(gitCommonDir(), "info", "l1-cache.json");

interface RunResult {
	wallMs: number;
	output: string;
	exitCode: number;
}

function run(cmd: string, args: string[]): Promise<RunResult> {
	return new Promise((resolve) => {
		const t0 = performance.now();
		const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], cwd: REPO_ROOT });
		let out = "";
		proc.stdout.on("data", (c) => (out += c.toString()));
		proc.stderr.on("data", (c) => (out += c.toString()));
		proc.on("close", (code) => {
			resolve({ wallMs: performance.now() - t0, output: out, exitCode: code ?? 0 });
		});
	});
}

function rmCache(): void {
	if (existsSync(L1_CACHE)) rmSync(L1_CACHE);
}

function bestOf(arr: number[]): number {
	return Math.min(...arr);
}

async function main(): Promise<void> {
	// Warm-up: ensure caches exist before timed phases.
	await run("bun", ["scripts/run-l1.ts"]);
	await run("bun", ["scripts/run-g1a.ts"]);
	// Extra warmup runs to stabilize FS cache + bun module resolution.
	for (let i = 0; i < 2; i++) {
		rmCache();
		await run("bun", ["scripts/run-l1.ts"]);
	}

	// L1 cache MISS trials
	const missTrials: number[] = [];
	for (let i = 0; i < TRIALS; i++) {
		rmCache();
		const r = await run("bun", ["scripts/run-l1.ts"]);
		if (r.exitCode !== 0) {
			console.error("L1 miss failed:", r.output);
			process.exit(1);
		}
		missTrials.push(r.wallMs);
	}

	// L1 cache HIT trials
	const hitTrials: number[] = [];
	for (let i = 0; i < TRIALS; i++) {
		const r = await run("bun", ["scripts/run-l1.ts"]);
		if (r.exitCode !== 0) {
			console.error("L1 hit failed:", r.output);
			process.exit(1);
		}
		hitTrials.push(r.wallMs);
	}

	// Full pre-commit wall (cache hit scenario — measures parallel overhead)
	const precommitTrials: number[] = [];
	for (let i = 0; i < TRIALS; i++) {
		const r = await run("bun", ["scripts/pre-commit.ts"]);
		// Don't fail if gitleaks complains in dev tree; just measure wall.
		precommitTrials.push(r.wallMs);
	}

	const l1MissMs = bestOf(missTrials);
	const l1HitMs = bestOf(hitTrials);
	const precommitWallMs = bestOf(precommitTrials);

	console.log("L1 miss trials:", missTrials.map((t) => Math.round(t)).join(", "));
	console.log("L1 hit trials :", hitTrials.map((t) => Math.round(t)).join(", "));
	console.log("pre-commit    :", precommitTrials.map((t) => Math.round(t)).join(", "));
	console.log("");
	console.log(`METRIC l1_miss_ms=${l1MissMs.toFixed(0)}`);
	console.log(`METRIC l1_hit_ms=${l1HitMs.toFixed(0)}`);
	console.log(`METRIC precommit_wall_ms=${precommitWallMs.toFixed(0)}`);
	console.log(`METRIC total_ms=${l1MissMs.toFixed(0)}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
