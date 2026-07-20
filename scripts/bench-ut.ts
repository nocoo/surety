#!/usr/bin/env bun
/**
 * Benchmark UT runtime + coverage across the monorepo.
 *
 * Runs `scripts/check-coverage.ts` (the actual hook) several times and reports:
 *   METRIC total_ms=...        (best wall-clock across trials)
 *   METRIC web_lines=...
 *   METRIC web_funcs=...
 *   METRIC worker_lines=...
 *   METRIC worker_funcs=...
 *   METRIC cli_lines=...
 *   METRIC cli_funcs=...
 *   METRIC test_count=...
 *
 * Usage: bun run scripts/bench-ut.ts [--trials N]
 */

import { spawn } from "node:child_process";

const TRIALS = Number(process.argv.find((a) => a.startsWith("--trials="))?.split("=")[1] ?? 3);

interface RunResult {
	wallMs: number;
	output: string;
	exitCode: number;
}

function run(cmd: string, args: string[]): Promise<RunResult> {
	return new Promise((resolve) => {
		const t0 = performance.now();
		const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		proc.stdout.on("data", (c) => (out += c.toString()));
		proc.stderr.on("data", (c) => (out += c.toString()));
		proc.on("close", (code) => {
			resolve({ wallMs: performance.now() - t0, output: out, exitCode: code ?? 0 });
		});
	});
}

interface Parsed {
	wallMs: number;
	webLines: number;
	webFuncs: number;
	workerLines: number;
	workerFuncs: number;
	cliLines: number;
	cliFuncs: number;
	testCount: number;
	ok: boolean;
}

function parse(r: RunResult): Parsed {
	const lines = r.output.split("\n");
	// group lines look like:  "✅ web          funcs=98.50%  lines=99.20%"
	const grp = (name: string, kind: "funcs" | "lines"): number => {
		const re = new RegExp(`${name}\\s+funcs=([\\d.]+)%\\s+lines=([\\d.]+)%`);
		for (const l of lines) {
			const m = l.match(re);
			if (m) return parseFloat(m[kind === "funcs" ? 1 : 2] ?? "0");
		}
		return 0;
	};
	// count passes from "X pass" lines (one per group, sum them)
	let passes = 0;
	for (const l of lines) {
		const m = l.match(/^\s*(\d+)\s+pass\s*$/);
		if (m) passes += parseInt(m[1] ?? "0", 10);
	}
	return {
		wallMs: r.wallMs,
		webLines: grp("web", "lines"),
		webFuncs: grp("web", "funcs"),
		workerLines: grp("worker", "lines"),
		workerFuncs: grp("worker", "funcs"),
		cliLines: grp("cli", "lines"),
		cliFuncs: grp("cli", "funcs"),
		testCount: passes,
		ok: r.exitCode === 0,
	};
}

async function main() {
	const trials: Parsed[] = [];
	// Warm-up
	await run("bun", ["run", "scripts/check-coverage.ts"]);

	for (let i = 0; i < TRIALS; i++) {
		const r = await run("bun", ["run", "scripts/check-coverage.ts"]);
		const p = parse(r);
		trials.push(p);
		console.log(
			`Trial ${i + 1}: wall=${p.wallMs.toFixed(0)}ms tests=${p.testCount} ok=${p.ok} ` +
				`web=${p.webLines}/${p.webFuncs} worker=${p.workerLines}/${p.workerFuncs} cli=${p.cliLines}/${p.cliFuncs}`,
		);
		if (!p.ok) {
			console.error("--- FAILED OUTPUT ---");
			console.error(r.output);
			process.exit(1);
		}
	}

	const best = trials.reduce((b, t) => (t.wallMs < b.wallMs ? t : b));
	console.log("");
	console.log(`METRIC total_ms=${best.wallMs.toFixed(0)}`);
	console.log(`METRIC web_lines=${best.webLines}`);
	console.log(`METRIC web_funcs=${best.webFuncs}`);
	console.log(`METRIC worker_lines=${best.workerLines}`);
	console.log(`METRIC worker_funcs=${best.workerFuncs}`);
	console.log(`METRIC cli_lines=${best.cliLines}`);
	console.log(`METRIC cli_funcs=${best.cliFuncs}`);
	console.log(`METRIC test_count=${best.testCount}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
