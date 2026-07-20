#!/usr/bin/env bun
/**
 * Benchmark pre-commit hook performance.
 *
 * Runs the full pre-commit pipeline (test:coverage + full lint + typecheck)
 * to measure end-to-end wall time.  Uses `bun run lint` (full repo) instead
 * of lint-staged for a stable, reproducible upper bound that does not depend
 * on what is currently staged in the working tree.
 */

import { spawn } from "bun";

interface Step {
	name: string;
	cmd: string[];
}

const STEPS: Step[] = [
	{ name: "test", cmd: ["bun", "run", "test:coverage"] },
	{ name: "lint", cmd: ["bun", "run", "lint"] },
	{ name: "typecheck", cmd: ["bun", "run", "typecheck"] },
];

interface Outcome {
	name: string;
	ok: boolean;
	ms: number;
}

async function runStep(step: Step): Promise<Outcome> {
	const start = performance.now();
	const proc = spawn(step.cmd, { stdout: "pipe", stderr: "pipe" });
	await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
	const code = await proc.exited;
	return { name: step.name, ok: code === 0, ms: performance.now() - start };
}

const mode = process.env.BENCH_MODE ?? "parallel";
const trials = Number(process.env.BENCH_TRIALS ?? "3");

interface Trial {
	perStep: Record<string, number>;
	wall: number;
	ok: boolean;
}

async function trial(): Promise<Trial> {
	const start = performance.now();
	let outcomes: Outcome[];
	if (mode === "sequential") {
		outcomes = [];
		for (const s of STEPS) outcomes.push(await runStep(s));
	} else {
		outcomes = await Promise.all(STEPS.map(runStep));
	}
	const wall = performance.now() - start;
	const perStep: Record<string, number> = {};
	let ok = true;
	for (const o of outcomes) {
		perStep[o.name] = o.ms;
		if (!o.ok) ok = false;
	}
	return { perStep, wall, ok };
}

const results: Trial[] = [];
for (let i = 0; i < trials; i++) results.push(await trial());

// best-of-trials per step + best wall
const bestStep: Record<string, number> = {};
for (const s of STEPS) {
	bestStep[s.name] = Math.min(...results.map((r) => r.perStep[s.name] ?? Infinity));
}
const bestWall = Math.min(...results.map((r) => r.wall));

for (const [name, ms] of Object.entries(bestStep)) {
	console.log(`METRIC ${name}_ms=${Math.round(ms)}`);
}
console.log(`METRIC wall_ms=${Math.round(bestWall)}`);
console.log(`METRIC total_ms=${Math.round(bestWall)}`);

if (results.some((r) => !r.ok)) process.exit(1);
