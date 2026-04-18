#!/usr/bin/env bun
/**
 * Benchmark pre-commit hook performance.
 *
 * Runs each step (test:coverage, lint, typecheck) sequentially as the real
 * pre-commit does (lint-staged invokes eslint on changed files; we use
 * `bun run lint` over the entire repo as a stable upper-bound proxy).
 *
 * Outputs METRIC lines for autoresearch parsing.
 */

import { spawnSync } from "bun";

interface Step {
  name: string;
  cmd: string[];
}

const STEPS: Step[] = [
  { name: "test", cmd: ["bun", "run", "test:coverage"] },
  { name: "lint", cmd: ["bun", "run", "lint"] },
  { name: "typecheck", cmd: ["bun", "run", "typecheck"] },
];

interface Result {
  name: string;
  ms: number;
  ok: boolean;
}

function runStep(step: Step): Result {
  const start = performance.now();
  const r = spawnSync(step.cmd, { stdout: "pipe", stderr: "pipe" });
  const ms = performance.now() - start;
  return { name: step.name, ms, ok: r.exitCode === 0 };
}

async function main() {
  // Warm-up: make sure typescript incremental cache is fresh from a previous run
  // We do NOT warm up — we want to measure realistic local-hook performance.
  const trials = Number(process.env.BENCH_TRIALS ?? "3");
  const allResults: Result[][] = [];

  for (let t = 0; t < trials; t++) {
    const trial: Result[] = [];
    for (const s of STEPS) trial.push(runStep(s));
    allResults.push(trial);
  }

  // best-of-trials per step (min) for stability
  const best: Record<string, number> = {};
  const okAll: Record<string, boolean> = {};
  for (const s of STEPS) {
    let m = Infinity;
    let ok = true;
    for (const trial of allResults) {
      const r = trial.find((x) => x.name === s.name);
      if (!r) continue;
      if (!r.ok) ok = false;
      if (r.ms < m) m = r.ms;
    }
    best[s.name] = m;
    okAll[s.name] = ok;
  }

  const total = Object.values(best).reduce((a, b) => a + b, 0);

  for (const [name, ms] of Object.entries(best)) {
    console.log(`METRIC ${name}_ms=${Math.round(ms)}`);
  }
  console.log(`METRIC total_ms=${Math.round(total)}`);
  for (const [name, ok] of Object.entries(okAll)) {
    if (!ok) {
      console.error(`step ${name} FAILED`);
      process.exit(1);
    }
  }
}

main();
