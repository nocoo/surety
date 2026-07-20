#!/usr/bin/env bun
/**
 * Pre-commit quality gates.
 *
 * 1. lint-staged runs FIRST and serially (biome --write). Full lint / tests /
 *    typecheck must not race with in-progress format rewrites.
 * 2. Remaining independent gates then run in parallel; each step's output is
 *    buffered and replayed in deterministic order so failures are easy to read.
 */

import { spawn } from "bun";

interface Step {
	name: string;
	cmd: string[];
}

/** Format + lint staged files before anything else reads them. */
const LINT_STAGED: Step = {
	name: "lint-staged",
	cmd: ["./node_modules/.bin/lint-staged"],
};

/** Independent of each other once staged files are settled. */
const PARALLEL_STEPS: Step[] = [
	{ name: "test", cmd: ["bun", "run", "scripts/run-l1.ts"] },
	// Full-repo biome gate so unstaged drift cannot sneak past staged-only green.
	{ name: "lint", cmd: ["bun", "run", "lint"] },
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

function report(r: Outcome): boolean {
	const status = r.ok ? "✅" : "❌";
	console.log(`\n${status} ${r.name} (${Math.round(r.ms)}ms)`);
	if (!r.ok) {
		if (r.stdout.trim()) console.log(r.stdout);
		if (r.stderr.trim()) console.error(r.stderr);
	}
	return r.ok;
}

// Phase 1: settle staged formatting/lint before other readers start.
const staged = await run(LINT_STAGED);
if (!report(staged)) process.exit(1);

// Phase 2: independent gates in parallel.
const results = await Promise.all(PARALLEL_STEPS.map(run));
let failed = false;
for (const r of results) {
	if (!report(r)) failed = true;
}

if (failed) process.exit(1);
