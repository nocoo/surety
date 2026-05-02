#!/usr/bin/env bun
/**
 * L1 cache + coverage gate for unit tests.
 *
 * On cache HIT: exit fast (just hash files, compare to cache).
 * On cache MISS: run `vitest run --coverage` which enforces thresholds
 *   configured in vitest.config.ts (statements/branches/functions/lines).
 *
 * Inputs hashed:
 *   - every *.ts / *.tsx file under src/, packages/, and test dirs
 *   - vitest.config.ts + root package.json
 *
 * Cache file: <git-common-dir>/info/l1-cache.json
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");

const SOURCE_ROOTS = [
  "apps/web/src",
  "apps/worker/src",
  "apps/worker/__tests__",
  "apps/cli/src",
  "apps/cli/__tests__",
  "packages/api/src",
  "packages/db/src",
].map((p) => join(REPO_ROOT, p));
const EXTRA_FILES = ["vitest.config.ts", "package.json"].map((p) => join(REPO_ROOT, p));

function gitCommonDir(): string {
  const dotGit = join(REPO_ROOT, ".git");
  if (existsSync(dotGit)) {
    const st = statSync(dotGit);
    if (st.isDirectory()) return dotGit;
    if (st.isFile()) {
      const txt = readFileSync(dotGit, "utf8").trim();
      const m = txt.match(/^gitdir:\s*(.+)$/m);
      if (m && m[1]) {
        const worktreeDir = resolve(REPO_ROOT, m[1]);
        return resolve(worktreeDir, "..", "..");
      }
    }
  }
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
  console.log(`✅ L1 cache hit (${files.length} files, ${hash.slice(0, 12)})`);
  process.exit(0);
}

console.log(`🧪 L1 cache miss — running vitest (${files.length} files)`);

const proc = Bun.spawnSync(["bunx", "vitest", "run", "--coverage"], {
  cwd: REPO_ROOT,
  stdout: "pipe",
  stderr: "pipe",
});

const stdout = proc.stdout.toString();
const stderr = proc.stderr.toString();

if (proc.exitCode !== 0) {
  console.log(stdout);
  if (stderr.trim()) console.error(stderr);
  console.error("\n❌ L1 coverage gate failed");
  process.exit(1);
}

// Print summary line from vitest output
const summaryLines = stdout.split("\n").filter(
  (l) => l.includes("Test Files") || l.includes("Tests ") || l.includes("All files")
);
for (const line of summaryLines) console.log(line.trim());

writeCache(cachePath, {
  hash,
  updatedAt: new Date().toISOString(),
  cmd: ["bunx", "vitest", "run", "--coverage"],
});
console.log(`💾 L1 cache updated (${hash.slice(0, 12)})`);
