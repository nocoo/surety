#!/usr/bin/env bun
/**
 * Run pre-push checks in parallel:
 *   - osv-scanner   (vulnerability scan, ~4s, network)
 *   - gitleaks      (staged secret scan, fast)
 *   - test:e2e      (long: spins remote D1 + dev server)
 *
 * All three are independent (read-only against repo / external services).
 * Output of each is buffered and replayed in deterministic order on
 * completion; e2e output is streamed live since it dwarfs everything else.
 */

import { spawn, type Subprocess } from "bun";

interface Step {
  name: string;
  cmd: string[];
  /** When true, inherit stdio so output streams live. */
  live?: boolean;
}

const STEPS: Step[] = [
  { name: "osv-scanner", cmd: ["osv-scanner", "--lockfile=bun.lock"] },
  { name: "gitleaks", cmd: ["gitleaks", "protect", "--staged", "--no-banner"] },
  // Legacy Next.js E2E targets a retired Worker proxy and is currently
  // broken; stand in with the worker + cli unit suites until the new
  // Hono/Vite E2E harness lands (docs/16-cli-replace-mcp.md Phase 5).
  {
    name: "worker+cli tests",
    cmd: [
      "bun",
      "test",
      "apps/worker/__tests__",
      "apps/cli/__tests__",
    ],
    live: true,
  },
  // L2 E2E for the Hono worker — uses the in-memory D1 harness in
  // __tests__/e2e/setup.ts. Listed separately so the bunfig E2E path-ignore
  // can be overridden for this step only.
  {
    name: "worker e2e",
    cmd: [
      "bun",
      "test",
      "apps/worker/__tests__/e2e",
      "--path-ignore-patterns",
      "__none__",
    ],
    live: true,
  },
];

interface Outcome {
  name: string;
  ok: boolean;
  ms: number;
  output?: string;
}

async function run(step: Step): Promise<Outcome> {
  const start = performance.now();
  const proc: Subprocess = spawn(step.cmd, {
    stdout: step.live ? "inherit" : "pipe",
    stderr: step.live ? "inherit" : "pipe",
  });
  let output = "";
  if (!step.live) {
    const [out, err] = await Promise.all([
      new Response(proc.stdout as ReadableStream).text(),
      new Response(proc.stderr as ReadableStream).text(),
    ]);
    output = (out + err).trim();
  }
  const code = await proc.exited;
  return { name: step.name, ok: code === 0, ms: performance.now() - start, output };
}

const results = await Promise.all(STEPS.map(run));

let failed = false;
console.log("\n──────── pre-push summary ────────");
for (const r of results) {
  const status = r.ok ? "✅" : "❌";
  console.log(`${status} ${r.name} (${Math.round(r.ms)}ms)`);
  if (!r.ok && r.output) {
    console.log(r.output);
    failed = true;
  } else if (!r.ok) {
    failed = true;
  }
}

if (failed) process.exit(1);
