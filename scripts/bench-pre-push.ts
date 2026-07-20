#!/usr/bin/env bun
/**
 * Benchmark the network-light pre-push steps (osv-scanner + gitleaks) in
 * sequential vs parallel mode.  E2E is excluded because it spins a remote
 * D1 + dev server (network-bound, multi-second) and would dominate noise.
 */

import { spawn } from "bun";

interface Step {
	name: string;
	cmd: string[];
}

const STEPS: Step[] = [
	{ name: "osv-scanner", cmd: ["osv-scanner", "--lockfile=bun.lock"] },
	{ name: "gitleaks", cmd: ["gitleaks", "protect", "--staged", "--no-banner"] },
];

async function runStep(step: Step): Promise<{ name: string; ok: boolean; ms: number }> {
	const start = performance.now();
	const proc = spawn(step.cmd, { stdout: "pipe", stderr: "pipe" });
	await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
	const code = await proc.exited;
	return { name: step.name, ok: code === 0, ms: performance.now() - start };
}

const mode = process.env.BENCH_MODE ?? "parallel";
const trials = Number(process.env.BENCH_TRIALS ?? "3");

interface T {
	perStep: Record<string, number>;
	wall: number;
	ok: boolean;
}

async function trial(): Promise<T> {
	const start = performance.now();
	const outcomes =
		mode === "sequential"
			? await (async () => {
					const out = [];
					for (const s of STEPS) out.push(await runStep(s));
					return out;
				})()
			: await Promise.all(STEPS.map(runStep));
	const wall = performance.now() - start;
	const perStep: Record<string, number> = {};
	let ok = true;
	for (const o of outcomes) {
		perStep[o.name] = o.ms;
		if (!o.ok) ok = false;
	}
	return { perStep, wall, ok };
}

const results: T[] = [];
for (let i = 0; i < trials; i++) results.push(await trial());

const bestStep: Record<string, number> = {};
for (const s of STEPS)
	bestStep[s.name] = Math.min(...results.map((r) => r.perStep[s.name] ?? Infinity));
const bestWall = Math.min(...results.map((r) => r.wall));

for (const [name, ms] of Object.entries(bestStep))
	console.log(`METRIC ${name.replace(/-/g, "_")}_ms=${Math.round(ms)}`);
console.log(`METRIC wall_ms=${Math.round(bestWall)}`);
console.log(`METRIC total_ms=${Math.round(bestWall)}`);

if (results.some((r) => !r.ok)) process.exit(1);
