#!/usr/bin/env bun
/**
 * Run the pre-commit checks (tests w/ coverage, lint-staged, typecheck) in
 * parallel.  They are independent: tests use in-memory SQLite, lint reads
 * source files, typecheck writes tsbuildinfo.  Output of each step is
 * buffered and replayed in deterministic order so failures are easy to read.
 */

import { spawn } from "bun";

interface Step {
	name: string;
	cmd: string[];
}

const STEPS: Step[] = [
	{ name: "test", cmd: ["bun", "run", "scripts/run-l1.ts"] },
	{ name: "lint-staged", cmd: ["./node_modules/.bin/lint-staged"] },
	{ name: "typecheck", cmd: ["bun", "run", "scripts/run-g1a.ts"] },
	{ name: "gitleaks", cmd: ["gitleaks", "protect", "--staged", "--no-banner"] },
];

interface Outcome {
	name: string;
	ok: boolean;
	ms: number;
	stdout: string;
	stderr: string;
}

async function run(step: Step): Promise<Outcome> {
	const start = performance.now();
	const proc = spawn(step.cmd, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	return {
		name: step.name,
		ok: code === 0,
		ms: performance.now() - start,
		stdout,
		stderr,
	};
}

const results = await Promise.all(STEPS.map(run));

let failed = false;
for (const r of results) {
	const status = r.ok ? "✅" : "❌";
	console.log(`\n${status} ${r.name} (${Math.round(r.ms)}ms)`);
	if (!r.ok) {
		failed = true;
		if (r.stdout.trim()) console.log(r.stdout);
		if (r.stderr.trim()) console.error(r.stderr);
	}
}

if (failed) process.exit(1);
