#!/usr/bin/env bun
/**
 * L2 HTTP runner — boots `wrangler dev --env test --local` against the
 * local D1 + R2 emulator on port 7017, applies the schema, then runs the
 * `apps/worker/__tests__/l2-http/**` suite as real `fetch()` clients.
 *
 * Tears the wrangler process down on exit (or test failure) so the port
 * is released for the next run.
 */

import { spawn, type Subprocess } from "bun";
import { rmSync } from "node:fs";
import { INIT_SQL } from "@surety/db";

const PORT = 7017;
const BASE = `http://127.0.0.1:${PORT}`;
const WORKER_DIR = `${import.meta.dir}/../apps/worker`;
const PERSIST_DIR = `${WORKER_DIR}/.wrangler/state-l2-http`;
const HEALTH_TIMEOUT_MS = 30_000;
const SHUTDOWN_GRACE_MS = 5_000;

let wrangler: Subprocess | null = null;

function log(msg: string): void {
  console.log(`[l2-http] ${msg}`);
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/live`);
      if (res.ok || res.status === 503) {
        // 503 still means worker is up — D1 may not yet have schema.
        return;
      }
    } catch (err) {
      lastErr = err;
    }
    await Bun.sleep(300);
  }
  throw new Error(
    `wrangler dev never became healthy on ${BASE}: ${String(lastErr)}`,
  );
}

function applySchema(): void {
  // Start from a clean slate so re-runs don't hit "table already exists".
  try {
    rmSync(PERSIST_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  const tmp = `${WORKER_DIR}/.l2-http-schema.sql`;
  Bun.write(tmp, INIT_SQL);
  log(`applying canonical INIT_SQL to local D1`);
  const proc = Bun.spawnSync(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      "surety-db-test",
      "--local",
      "--env",
      "test",
      "--persist-to",
      ".wrangler/state-l2-http",
      `--file=${tmp}`,
    ],
    { cwd: WORKER_DIR, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    console.error(proc.stdout.toString());
    console.error(proc.stderr.toString());
    throw new Error("schema apply failed");
  }
}

async function startWrangler(): Promise<void> {
  log(`starting wrangler dev on :${PORT}`);
  wrangler = spawn(
    [
      "bunx",
      "wrangler",
      "dev",
      "--env",
      "test",
      "--local",
      "--persist-to",
      ".wrangler/state-l2-http",
      "--port",
      String(PORT),
      "--inspector-port",
      "0",
      "--ip",
      "127.0.0.1",
    ],
    {
      cwd: WORKER_DIR,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, WRANGLER_LOG: "error" },
    },
  );
  // Drain stdout/stderr so the pipe buffer never fills.
  const drain = async (
    stream: ReadableStream<Uint8Array>,
    label: string,
  ): Promise<void> => {
    const reader = stream.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) process.stderr.write(`[${label}] ${dec.decode(value)}`);
    }
  };
  void drain(wrangler.stdout as ReadableStream<Uint8Array>, "wrangler");
  void drain(wrangler.stderr as ReadableStream<Uint8Array>, "wrangler!");
}

async function stopWrangler(): Promise<void> {
  if (!wrangler) return;
  log("stopping wrangler dev");
  wrangler.kill("SIGTERM");
  const t = setTimeout(() => {
    if (wrangler && wrangler.exitCode === null) {
      wrangler.kill("SIGKILL");
    }
  }, SHUTDOWN_GRACE_MS);
  await wrangler.exited;
  clearTimeout(t);
  wrangler = null;
}

async function runTests(): Promise<number> {
  const proc = spawn(
    [
      "bun",
      "test",
      "apps/worker/__tests__/l2-http",
      "--path-ignore-patterns",
      "__none__",
    ],
    {
      cwd: `${import.meta.dir}/..`,
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env, L2_HTTP_BASE_URL: BASE },
    },
  );
  return await proc.exited;
}

async function main(): Promise<void> {
  applySchema();
  await startWrangler();
  try {
    await waitForHealth();
    const code = await runTests();
    process.exitCode = code;
  } finally {
    await stopWrangler();
  }
}

const cleanup = async (): Promise<void> => {
  await stopWrangler();
  process.exit(process.exitCode ?? 1);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

await main();
