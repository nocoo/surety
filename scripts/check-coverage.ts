#!/usr/bin/env bun
/**
 * Coverage gate across the whole monorepo.
 *
 * Runs each app's unit tests with coverage and enforces line ≥ LINE_THRESHOLD
 * and function ≥ FUNC_THRESHOLD on the aggregate "All files" line per group.
 *
 * Bun's text reporter emits two columns (% Funcs | % Lines), so those are the
 * two dimensions we can gate on.
 */

const LINE_THRESHOLD = 90;
const FUNC_THRESHOLD = 85;

interface Group {
  name: string;
  cwd: string;
  cmd: string;
}

const repoRoot = import.meta.dir + "/..";

const GROUPS: Group[] = [
  {
    name: "web",
    cwd: repoRoot,
    cmd: "bun test apps/web/src/__tests__/ --coverage",
  },
  {
    name: "worker",
    cwd: repoRoot,
    cmd: "bun test apps/worker/__tests__/ --coverage",
  },
  {
    name: "cli",
    cwd: repoRoot,
    cmd: "bun test apps/cli/__tests__/ --coverage",
  },
];

interface Result {
  name: string;
  funcs: number;
  lines: number;
  output: string;
  ok: boolean;
}

async function runGroup(g: Group): Promise<Result> {
  const proc = Bun.spawn(["bash", "-c", `cd "${g.cwd}" && ${g.cmd}`], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: repoRoot,
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  const full = out + err;

  const allFilesLine = full
    .split("\n")
    .find((l) => l.includes("All files"));
  if (!allFilesLine) {
    return { name: g.name, funcs: 0, lines: 0, output: full, ok: false };
  }
  const match = allFilesLine.match(
    /All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/,
  );
  if (!match) {
    return { name: g.name, funcs: 0, lines: 0, output: full, ok: false };
  }
  const funcs = parseFloat(match[1] ?? "0");
  const lines = parseFloat(match[2] ?? "0");
  const ok = lines >= LINE_THRESHOLD && funcs >= FUNC_THRESHOLD;
  return { name: g.name, funcs, lines, output: full, ok };
}

async function main() {
  console.log(
    `🧪 Coverage gate (line ≥ ${LINE_THRESHOLD}%, func ≥ ${FUNC_THRESHOLD}%)\n`,
  );

  const results = await Promise.all(GROUPS.map(runGroup));

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
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
