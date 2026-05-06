#!/usr/bin/env bun
/**
 * L3 server runner — builds the Vite SPA into `apps/worker/static/`
 * and starts `wrangler dev --local` on port 27012 so
 * Playwright's webServer can reach a single endpoint that serves both
 * `/api/*` and the SPA shell.
 *
 * Uses top-level wrangler.toml bindings (no --env) with --var overrides
 * for E2E_SKIP_AUTH + ENVIRONMENT to bypass auth locally.
 *
 * Designed to be invoked from `playwright.config.ts` via `webServer.command`.
 * Stays in the foreground so Playwright can manage its lifetime.
 */

import { spawn, spawnSync } from "bun";
import { rmSync } from "node:fs";
import { INIT_SQL } from "@surety/db";

const PORT = Number(process.env.L3_PORT ?? 27012);
const REPO_ROOT = `${import.meta.dir}/..`;
const WEB_DIR = `${REPO_ROOT}/apps/web`;
const WORKER_DIR = `${REPO_ROOT}/apps/worker`;
const PERSIST_DIR = `${WORKER_DIR}/.wrangler/state-l3`;

function log(msg: string): void {
  console.log(`[l3] ${msg}`);
}

function buildSpa(): void {
  log("building Vite SPA → apps/worker/static/");
  const r = spawnSync(["bun", "run", "build"], {
    cwd: WEB_DIR,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (r.exitCode !== 0) {
    throw new Error("vite build failed");
  }
}

function applySchema(): void {
  try {
    rmSync(PERSIST_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  const tmp = `${WORKER_DIR}/.l3-schema.sql`;
  Bun.write(tmp, INIT_SQL);
  log("applying canonical INIT_SQL to local D1");
  const r = spawnSync(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      "surety-db",
      "--local",
      "--persist-to",
      ".wrangler/state-l3",
      `--file=${tmp}`,
    ],
    { cwd: WORKER_DIR, stdout: "pipe", stderr: "pipe" },
  );
  if (r.exitCode !== 0) {
    console.error(r.stdout?.toString());
    console.error(r.stderr?.toString());
    throw new Error("schema apply failed");
  }
}

async function startWrangler(): Promise<never> {
  log(`starting wrangler dev on :${PORT}`);
  const p = spawn(
    [
      "bunx",
      "wrangler",
      "dev",
      "--local",
      "--persist-to",
      ".wrangler/state-l3",
      "--port",
      String(PORT),
      "--inspector-port",
      "0",
      "--ip",
      "127.0.0.1",
      "--var",
      "E2E_SKIP_AUTH:true",
      "--var",
      "ENVIRONMENT:test",
    ],
    {
      cwd: WORKER_DIR,
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env, WRANGLER_LOG: "error" },
    },
  );
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => p.kill(sig));
  }
  await p.exited;
  process.exit(p.exitCode ?? 0);
}

buildSpa();
applySchema();
await startWrangler();

