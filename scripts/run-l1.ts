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
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const SOURCE_ROOTS = [
  "apps/web/src",
  "apps/worker/src",
  "apps/worker/__tests__",
  "packages/api/src",
  "packages/db/src",
].map((p) => join(REPO_ROOT, p));
const EXTRA_FILES = ["bunfig.toml", "package.json"].map((p) => join(REPO_ROOT, p));

// Test command — must mirror the "test" script in package.json but add coverage.
// Globs are shell-expanded, so run via `sh -c`.
const TEST_SHELL_CMD = [
  "bun test apps/web/src/__tests__/ --coverage",
  "bun test apps/worker/__tests__/ --coverage",
  "bun test apps/cli/__tests__/ --coverage",
].join(" && ");

function gitCommonDir(): string {
  const r = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`git rev-parse failed: ${r.stderr}`);
  }
  const dir = r.stdout.trim();
  return resolve(REPO_ROOT, dir);
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
  console.log(`✅ L1 cache hit (${files.length} files, ${hash.slice(0, 12)})`);
  process.exit(0);
}

console.log(`🧪 L1 cache miss — running unit tests (${files.length} files)`);
const proc = spawnSync("sh", ["-c", TEST_SHELL_CMD], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

if (proc.status !== 0) {
  process.exit(proc.status ?? 1);
}

writeCache(cachePath, {
  hash,
  updatedAt: new Date().toISOString(),
  cmd: ["sh", "-c", TEST_SHELL_CMD],
});
console.log(`💾 L1 cache updated (${hash.slice(0, 12)})`);
