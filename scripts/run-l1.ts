#!/usr/bin/env bun
/**
 * L1 cache: skip the unit-test suite when no input has changed since the last
 * green run.
 *
 * Inputs hashed:
 *   - every *.ts / *.tsx file under src/ and packages/
 *   - bunfig.toml
 *   - root package.json (test scripts can change)
 *
 * Cache file: <git-common-dir>/info/l1-cache.json
 *
 * On hit: print "L1 cache hit" and exit 0.
 * On miss: run the unit-test suite (with coverage); on success update cache.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");

// Test command — must mirror the "test:coverage" gate. We delegate to
// check-coverage.ts which (a) runs the 3 per-app `bun test --coverage`
// invocations in parallel, and (b) enforces the 95% line + function gates.
// Sequential `bun test && bun test && bun test` invocations were both slower
// AND skipped coverage thresholds — see autoresearch run #66 baseline.
const TEST_CMD: [string, ...string[]] = [
  "bun",
  "--bun",
  "scripts/check-coverage.ts",
];

// Speculatively start the test child immediately, in parallel with hashing.
// On cache hit we kill it; on miss we await it. Saves ~25ms on cache miss
// by overlapping bun startup of the child with the wrapper's hash work.
const speculative = Bun.spawn(TEST_CMD, {
  stdout: "inherit",
  stderr: "inherit",
  cwd: REPO_ROOT,
});

const SOURCE_ROOTS = [
  "apps/web/src",
  "apps/worker/src",
  "apps/worker/__tests__",
  "packages/api/src",
  "packages/db/src",
].map((p) => join(REPO_ROOT, p));
const EXTRA_FILES = ["bunfig.toml", "package.json"].map((p) => join(REPO_ROOT, p));

// Resolve the git common dir without spawning `git rev-parse` (saves ~10ms).
// In the common case `.git` is a directory at the repo root. For worktrees,
// `.git` is a file containing `gitdir: <path>` — fall back to that. Only when
// neither matches do we shell out to git.
function gitCommonDir(): string {
  const dotGit = join(REPO_ROOT, ".git");
  if (existsSync(dotGit)) {
    const st = statSync(dotGit);
    if (st.isDirectory()) {
      return dotGit;
    }
    if (st.isFile()) {
      const txt = readFileSync(dotGit, "utf8").trim();
      const m = txt.match(/^gitdir:\s*(.+)$/m);
      if (m && m[1]) {
        const worktreeDir = resolve(REPO_ROOT, m[1]);
        return resolve(worktreeDir, "..", "..");
      }
    }
  }
  // Fallback: ask git.
  const r = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`git rev-parse failed: ${r.stderr}`);
  }
  return resolve(REPO_ROOT, r.stdout.trim());
}

function walk(root: string, exts: Set<string>, out: string[]): void {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      walk(full, exts, out);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf(".");
      const ext = dot >= 0 ? entry.name.slice(dot) : "";
      if (exts.has(ext)) out.push(full);
    }
  }
}

function collectFiles(): string[] {
  const exts = new Set([".ts", ".tsx"]);
  const files: string[] = [];
  for (const root of SOURCE_ROOTS) walk(root, exts, files);
  for (const extra of EXTRA_FILES) {
    if (existsSync(extra)) files.push(extra);
  }
  files.sort();
  return files;
}

function hashFiles(files: string[]): string {
  const h = createHash("sha256");
  for (const f of files) {
    const rel = relative(REPO_ROOT, f);
    const data = readFileSync(f);
    h.update(rel);
    h.update("\0");
    h.update(data);
    h.update("\0");
  }
  return h.digest("hex");
}

interface Cache {
  hash: string;
  updatedAt: string;
  cmd: string[];
}

function readCache(path: string): Cache | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Cache;
  } catch {
    return null;
  }
}

function writeCache(path: string, cache: Cache): void {
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2));
}

const cachePath = join(gitCommonDir(), "info", "l1-cache.json");
const files = collectFiles();
const hash = hashFiles(files);
const cached = readCache(cachePath);

if (cached && cached.hash === hash) {
  // Cancel the speculative test run — we don't need it.
  speculative.kill();
  console.log(`✅ L1 cache hit (${files.length} files, ${hash.slice(0, 12)})`);
  process.exit(0);
}

console.log(`🧪 L1 cache miss — running unit tests (${files.length} files)`);
const exitCode = await speculative.exited;

if (exitCode !== 0) {
  process.exit(exitCode);
}

writeCache(cachePath, {
  hash,
  updatedAt: new Date().toISOString(),
  cmd: [...TEST_CMD],
});
console.log(`💾 L1 cache updated (${hash.slice(0, 12)})`);
