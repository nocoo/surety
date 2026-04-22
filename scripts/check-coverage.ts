#!/usr/bin/env bun
/**
 * Coverage gate across the whole monorepo.
 *
 * Spawns the per-app `bun test --coverage` invocations FIRST (top-level,
 * before any other parsing/IO) so the slow child procs start as early as
 * possible. Then enforces line ≥ LINE_THRESHOLD and function ≥ FUNC_THRESHOLD
 * on the aggregate "All files" line per group.
 */

const repoRoot = import.meta.dir + "/..";

// Hoist spawn to top-level: kicks off the 3 child bun procs immediately,
// before we declare types, helpers, or print the banner. Saves the parsing
// cost of the rest of this script that would otherwise be on the critical path.
const spawned = [
  ["web", "apps/web/src/__tests__/"],
  ["worker", "apps/worker/__tests__/"],
  ["cli", "apps/cli/__tests__/"],
].map(([name, path]) => ({
  name: name as string,
  proc: Bun.spawn(["bun", "--bun", "test", path as string, "--coverage"], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: repoRoot,
  }),
}));

const LINE_THRESHOLD = 95;
const FUNC_THRESHOLD = 95;

interface Result {
  name: string;
  funcs: number;
  lines: number;
  output: string;
  ok: boolean;
}

async function collect(s: { name: string; proc: ReturnType<typeof Bun.spawn> }): Promise<Result> {
  const [out, err] = await Promise.all([
    new Response(s.proc.stdout as ReadableStream).text(),
    new Response(s.proc.stderr as ReadableStream).text(),
  ]);
  await s.proc.exited;
  const full = out + err;

  const allFilesLine = full.split("\n").find((l) => l.includes("All files"));
  if (!allFilesLine) {
    return { name: s.name, funcs: 0, lines: 0, output: full, ok: false };
  }
  const match = allFilesLine.match(
    /All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/,
  );
  if (!match) {
    return { name: s.name, funcs: 0, lines: 0, output: full, ok: false };
  }
  const funcs = parseFloat(match[1] ?? "0");
  const lines = parseFloat(match[2] ?? "0");
  const ok = lines >= LINE_THRESHOLD && funcs >= FUNC_THRESHOLD;
  return { name: s.name, funcs, lines, output: full, ok };
}

console.log(
  `🧪 Coverage gate (line ≥ ${LINE_THRESHOLD}%, func ≥ ${FUNC_THRESHOLD}%)\n`,
);

const results = await Promise.all(spawned.map(collect));

let failed = false;
for (const r of results) {
  const status = r.ok ? "✅" : "❌";
  console.log(
    `${status} ${r.name.padEnd(12)} funcs=${r.funcs.toFixed(2)}%  lines=${r.lines.toFixed(2)}%`,
  );
  if (!r.ok) {
    failed = true;
    console.log(r.output);
  }
}

if (failed) {
  console.error("\n❌ Coverage gate failed");
  process.exit(1);
}
console.log("\n✅ Coverage gate passed");
