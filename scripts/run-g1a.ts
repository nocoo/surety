#!/usr/bin/env bun

/**
 * G1a cache: skip `tsc --noEmit` when no input has changed since the last
 * green run.
 *
 * Inputs hashed:
 *   - every *.ts / *.tsx file under src/ and packages/
 *   - every tsconfig*.json under the repo root
 *
 * Cache file: <git-common-dir>/info/g1a-cache.json
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const SOURCE_ROOTS = ["apps/web/src", "apps/worker/src", "apps/cli/src", "packages"].map((p) =>
	join(REPO_ROOT, p),
);

const TYPECHECK_CMD = ["bun", "run", "typecheck"];

function gitCommonDir(): string {
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

function tsconfigFiles(): string[] {
	const out: string[] = [];
	for (const name of readdirSync(REPO_ROOT)) {
		if (/^tsconfig.*\.json$/.test(name)) out.push(join(REPO_ROOT, name));
	}
	out.sort();
	return out;
}

function collectFiles(): string[] {
	const exts = new Set([".ts", ".tsx"]);
	const files: string[] = [];
	for (const root of SOURCE_ROOTS) walk(root, exts, files);
	for (const tsc of tsconfigFiles()) files.push(tsc);
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

const cachePath = join(gitCommonDir(), "info", "g1a-cache.json");
const files = collectFiles();
const hash = hashFiles(files);
const cached = readCache(cachePath);

if (cached && cached.hash === hash) {
	console.log(`✅ G1a cache hit (${files.length} files, ${hash.slice(0, 12)})`);
	process.exit(0);
}

console.log(`🔎 G1a cache miss — running typecheck (${files.length} files)`);
const cmd = TYPECHECK_CMD[0];
if (!cmd) throw new Error("TYPECHECK_CMD is empty");
const proc = spawnSync(cmd, TYPECHECK_CMD.slice(1), {
	cwd: REPO_ROOT,
	stdio: "inherit",
});

if (proc.status !== 0) {
	process.exit(proc.status ?? 1);
}

writeCache(cachePath, {
	hash,
	updatedAt: new Date().toISOString(),
	cmd: TYPECHECK_CMD,
});
console.log(`💾 G1a cache updated (${hash.slice(0, 12)})`);
