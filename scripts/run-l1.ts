#!/usr/bin/env bun
/**
 * L1 cache + coverage gate for unit tests.
 *
 * On cache HIT: exit fast (just hash files, compare to cache).
 * On cache MISS: run the 3 per-app `bun test --coverage` shards in parallel
 *   AND enforce 95% line + function coverage per shard. Speculatively spawns
 *   the test shards at script start so their bun startup overlaps with the
 *   cache-hashing work.
 *
 * Inputs hashed:
 *   - every *.ts / *.tsx file under src/ and packages/
 *   - bunfig.toml + root package.json (test scripts can change)
 *
 * Cache file: <git-common-dir>/info/l1-cache.json
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");

// Speculatively start the 3 test shards immediately (top-level Bun.spawn) so
// their bun startup + module load overlaps with the wrapper's hash work. On
// cache hit we kill them; on miss we await + parse coverage. Saves ~25-50ms
// on cache miss vs spawning after the cache decision.
const SHARDS = [
  { name: "web", path: "apps/web/src/__tests__/" },
  { name: "worker", path: "apps/worker/__tests__/" },
  { name: "cli", path: "apps/cli/__tests__/" },
] as const;

const speculative = SHARDS.map((s) => ({
  name: s.name,
  proc: Bun.spawn(["bun", "--bun", "test", s.path, "--coverage"], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: REPO_ROOT,
  }),
}));

const SOURCE_ROOTS = [
  "apps/web/src",
  "apps/worker/src",
  "apps/worker/__tests__",
  "packages/api/src",
  "packages/db/src",
].map((p) => join(REPO_ROOT, p));
const EXTRA_FILES = ["bunfig.toml", "package.json"].map((p) => join(REPO_ROOT, p));

const LINE_THRESHOLD = 95;
const FUNC_THRESHOLD = 95;

// Resolve the git common dir without spawning `git rev-parse` (saves ~10ms).
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

interface ShardResult {
  name: string;
  funcs: number;
  lines: number;
  output: string;
  ok: boolean;
}

// Worker shard's coverage table includes route files that are loaded but
// only exercised via L2/L3 E2E (not L1). Filter to the files that have unit
// tests so the gate stays tight without false negatives.
const WORKER_INCLUDE_PREFIXES = [
  "apps/worker/src/middleware/",
  "apps/worker/src/routes/auth-cli.ts",
  "apps/worker/src/routes/auth.ts",
  "apps/worker/src/routes/live.ts",
  "apps/worker/src/routes/me.ts",
  "apps/worker/src/index.ts",
  "apps/worker/src/lib/",
];

async function collectShard(s: { name: string; proc: ReturnType<typeof Bun.spawn> }): Promise<ShardResult> {
  const [out, err] = await Promise.all([
    new Response(s.proc.stdout as ReadableStream).text(),
    new Response(s.proc.stderr as ReadableStream).text(),
  ]);
  await s.proc.exited;
  const full = out + err;

  if (s.name === "worker") {
    const fileLineRe = /^\s*(.+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/;
    let totalFuncs = 0, totalLines = 0, fileCount = 0;
    for (const line of full.split("\n")) {
      const m = line.match(fileLineRe);
      if (!m) continue;
      const filePath = (m[1] ?? "").trim();
      if (filePath === "All files" || filePath.startsWith("---")) continue;
      if (!WORKER_INCLUDE_PREFIXES.some((p) => filePath.startsWith(p))) continue;
      totalFuncs += parseFloat(m[2] ?? "0");
      totalLines += parseFloat(m[3] ?? "0");
      fileCount++;
    }
    if (fileCount === 0) {
      return { name: s.name, funcs: 0, lines: 0, output: full, ok: false };
    }
    const funcs = totalFuncs / fileCount;
    const lines = totalLines / fileCount;
    return { name: s.name, funcs, lines, output: full, ok: lines >= LINE_THRESHOLD && funcs >= FUNC_THRESHOLD };
  }

  const allFilesLine = full.split("\n").find((l) => l.includes("All files"));
  if (!allFilesLine) return { name: s.name, funcs: 0, lines: 0, output: full, ok: false };
  const match = allFilesLine.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/);
  if (!match) return { name: s.name, funcs: 0, lines: 0, output: full, ok: false };
  const funcs = parseFloat(match[1] ?? "0");
  const lines = parseFloat(match[2] ?? "0");
  return { name: s.name, funcs, lines, output: full, ok: lines >= LINE_THRESHOLD && funcs >= FUNC_THRESHOLD };
}

const cachePath = join(gitCommonDir(), "info", "l1-cache.json");
const files = collectFiles();
const hash = hashFiles(files);
const cached = readCache(cachePath);

if (cached && cached.hash === hash) {
  for (const s of speculative) s.proc.kill();
  console.log(`✅ L1 cache hit (${files.length} files, ${hash.slice(0, 12)})`);
  process.exit(0);
}

console.log(
  `🧪 L1 cache miss — running unit tests (${files.length} files, line ≥ ${LINE_THRESHOLD}%, func ≥ ${FUNC_THRESHOLD}%)`,
);

const results = await Promise.all(speculative.map(collectShard));

let failed = false;
for (const r of results) {
  const status = r.ok ? "✅" : "❌";
  console.log(
    `${status} ${r.name.padEnd(8)} funcs=${r.funcs.toFixed(2)}%  lines=${r.lines.toFixed(2)}%`,
  );
  if (!r.ok) {
    failed = true;
    console.log(r.output);
  }
}

if (failed) {
  console.error("\n❌ L1 coverage gate failed");
  process.exit(1);
}

writeCache(cachePath, {
  hash,
  updatedAt: new Date().toISOString(),
  cmd: ["bun", "--bun", "test", "<per-shard>", "--coverage"],
});
console.log(`💾 L1 cache updated (${hash.slice(0, 12)})`);
