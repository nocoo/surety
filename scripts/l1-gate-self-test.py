#!/usr/bin/env python3
"""Exercise the real Husky pre-commit gate against isolated git index mutations."""

from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

DEPENDENCY_DIRS = (
    "node_modules",
    "apps/cli/node_modules",
    "apps/web/node_modules",
    "apps/worker/node_modules",
    "packages/api/node_modules",
    "packages/db/node_modules",
)

HOOK_SNIPPET = (
    "import subprocess\n"
    "source = subprocess.run(['git', 'show', ':scripts/pre-commit.py'], "
    "check=True, stdout=subprocess.PIPE).stdout\n"
    "exec(compile(source, 'scripts/pre-commit.py', 'exec'))\n"
)


@dataclass
class Scenario:
    name: str
    expect_failure: bool
    setup: str  # key into SCENARIO_SETUPS


@dataclass
class Result:
    name: str
    expect_failure: bool
    exit_code: int | None
    ok: bool
    detail: str


def run_git(args: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=check,
        text=True,
        capture_output=True,
    )


def link_dependencies(source_repo: Path, worktree: Path) -> None:
    for relative in DEPENDENCY_DIRS:
        src = source_repo / relative
        dst = worktree / relative
        if not src.is_dir():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() or dst.is_symlink():
            continue
        dst.symlink_to(src, target_is_directory=True)


def reset_worktree(worktree: Path) -> None:
    run_git(["reset", "--hard", "HEAD"], worktree)
    run_git(["clean", "-fd"], worktree)


def stage_file(worktree: Path, relative: str, content: str) -> Path:
    path = worktree / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8")
    run_git(["add", relative], worktree)
    return path


def stage_index_only(worktree: Path, relative: str, staged: str, working: str) -> None:
    path = stage_file(worktree, relative, staged)
    path.write_text(working, encoding="utf-8")


def run_hook(worktree: Path, env: dict[str, str] | None = None) -> tuple[int, str]:
    command = [sys.executable, "-B", "-c", HOOK_SNIPPET]
    merged = dict(os.environ)
    merged["PATH"] = os.environ.get("PATH", "")
    if env:
        merged.update(env)
    proc = subprocess.run(
        command,
        cwd=worktree,
        env=merged,
        text=True,
        capture_output=True,
    )
    output = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, output


def run_hook_interrupt(worktree: Path) -> tuple[int, str]:
    command = [sys.executable, "-B", "-c", HOOK_SNIPPET]
    proc = subprocess.Popen(
        command,
        cwd=worktree,
        env=os.environ.copy(),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    time.sleep(0.6)
    try:
        os.killpg(proc.pid, signal.SIGINT)
    except ProcessLookupError:
        pass
    try:
        output, _ = proc.communicate(timeout=120)
    except subprocess.TimeoutExpired:
        proc.kill()
        output, _ = proc.communicate()
        return 1, (output or "") + "\n(killed after interrupt timeout)"
    return proc.returncode, output or ""


def try_commit(worktree: Path, message: str) -> tuple[int, str]:
    commit = subprocess.run(
        ["git", "commit", "--allow-empty", "-m", message],
        cwd=worktree,
        env=os.environ.copy(),
        text=True,
        capture_output=True,
    )
    return commit.returncode, (commit.stdout or "") + (commit.stderr or "")


def setup_ut_fail(wt: Path) -> None:
    stage_file(
        wt,
        "apps/web/src/__tests__/l1-gate-ut-fail.test.ts",
        'import { describe, expect, it } from "vitest";\n\n'
        'describe("l1 gate ut fail", () => {\n'
        '\tit("fails", () => {\n'
        "\t\texpect(true).toBe(false);\n"
        "\t});\n"
        "});\n",
    )


def setup_coverage_low(wt: Path, metric: str) -> None:
    branches = (
        "export function l1ProbeBranches(n: number): number {\n"
        "\tif (n < 0) return -1;\n"
        "\tif (n === 0) return 0;\n"
        "\tif (n === 1) return 1;\n"
        "\tif (n === 2) return 2;\n"
        "\tif (n === 3) return 3;\n"
        "\tif (n % 2 === 0) return n;\n"
        "\treturn n + 1;\n"
        "}\n"
    )
    body = "\n".join(f"export const l1Stmt{i} = {i};" for i in range(80))
    if metric == "branches":
        body = branches
    elif metric == "functions":
        body = "\n".join(
            f"export function l1Fn{i}(): number {{\n\treturn {i};\n}}" for i in range(30)
        )
    elif metric == "lines":
        body = "\n".join(f"export const l1Line{i} = `line-{i}`;" for i in range(80))
    stage_file(wt, "apps/web/src/lib/l1-gate-coverage-probe.ts", body)


def setup_lint_error(wt: Path) -> None:
    stage_file(wt, "apps/web/src/lib/l1-gate-lint-error.ts", "const broken = ;\n")


def setup_lint_warning(wt: Path) -> None:
    biome = json.loads((wt / "biome.json").read_text(encoding="utf-8"))
    biome.setdefault("linter", {}).setdefault("rules", {}).setdefault("suspicious", {})[
        "noConsole"
    ] = "warn"
    stage_file(wt, "biome.json", json.dumps(biome, indent="\t") + "\n")
    stage_file(wt, "apps/web/src/lib/l1-gate-lint-warn.ts", 'console.log("l1 probe");\n')


def setup_type_error(wt: Path) -> None:
    stage_file(
        wt,
        "apps/cli/src/l1-gate-type-error.ts",
        'export const l1TypeError: number = "not-a-number";\n',
    )


def setup_focused_test(wt: Path) -> None:
    stage_file(
        wt,
        "apps/web/src/__tests__/l1-gate-focused.test.ts",
        'import { describe, expect, it } from "vitest";\n'
        'describe("l1 gate focused", () => {\n'
        "  it.only('focused', () => { expect(1).toBe(1); });\n"
        "});\n",
    )


def setup_skipped_test(wt: Path) -> None:
    stage_file(
        wt,
        "apps/web/src/__tests__/l1-gate-skipped.test.ts",
        'import { describe, expect, it } from "vitest";\n'
        'describe("l1 gate skipped", () => {\n'
        "  it.skip('skipped', () => { expect(1).toBe(2); });\n"
        "  it('passes', () => { expect(1).toBe(1); });\n"
        "});\n",
    )


def setup_index_mismatch(wt: Path) -> None:
    bad = 'export const l1IndexProbe: number = "staged-bad";\n'
    stage_file(wt, "apps/web/src/lib/l1-index-probe.ts", bad)
    path = wt / "apps/web/src/lib/l1-index-probe.ts"
    if path.exists():
        path.unlink()


def setup_missing_tool(wt: Path) -> None:
    del wt  # hook env overrides PATH


def setup_timeout(wt: Path) -> None:
    del wt


SCENARIO_SETUPS = {
    "ut_fail": setup_ut_fail,
    "coverage_statements": lambda wt: setup_coverage_low(wt, "statements"),
    "coverage_branches": lambda wt: setup_coverage_low(wt, "branches"),
    "coverage_functions": lambda wt: setup_coverage_low(wt, "functions"),
    "coverage_lines": lambda wt: setup_coverage_low(wt, "lines"),
    "lint_error": setup_lint_error,
    "lint_warning": setup_lint_warning,
    "type_error": setup_type_error,
    "focused_test": setup_focused_test,
    "skipped_test": setup_skipped_test,
    "index_mismatch": setup_index_mismatch,
    "missing_tool": setup_missing_tool,
    "timeout": setup_timeout,
}

SCENARIOS = [
    Scenario("healthy_hook", False, "healthy"),
    Scenario("ut_fail", True, "ut_fail"),
    Scenario("coverage_statements", True, "coverage_statements"),
    Scenario("coverage_branches", True, "coverage_branches"),
    Scenario("coverage_functions", True, "coverage_functions"),
    Scenario("coverage_lines", True, "coverage_lines"),
    Scenario("lint_error", True, "lint_error"),
    Scenario("lint_warning", True, "lint_warning"),
    Scenario("type_error", True, "type_error"),
    Scenario("focused_test", True, "focused_test"),
    Scenario("skipped_test", True, "skipped_test"),
    Scenario("index_mismatch", True, "index_mismatch"),
    Scenario("missing_tool", True, "missing_tool"),
    Scenario("timeout", True, "timeout"),
    Scenario("interrupt", True, "healthy"),
    Scenario("healthy_commit", False, "healthy"),
]


def hook_env_for(name: str) -> dict[str, str]:
    if name == "missing_tool":
        home = Path.home()
        return {
            "PATH": os.pathsep.join(
                ["/usr/bin", "/bin", str(home / ".bun" / "bin"), "/exec-daemon"]
            )
        }
    if name == "timeout":
        return {
            "SURETY_L1_GATE_SELF_TEST": "1",
            "SURETY_L1_TIMEOUT": "0.2",
            "SURETY_L1_GATE_SELF_TEST_SLEEP": "2",
        }
    return {}


def exercise_scenario(worktree: Path, scenario: Scenario) -> Result:
    reset_worktree(worktree)
    if scenario.setup != "healthy":
        setup = SCENARIO_SETUPS[scenario.setup]
        setup(worktree)
    head_before = run_git(["rev-parse", "HEAD"], worktree).stdout.strip()
    env = hook_env_for(scenario.name)

    if scenario.name == "interrupt":
        code, output = run_hook_interrupt(worktree)
    elif scenario.name == "healthy_commit":
        code, output = try_commit(worktree, "l1 gate healthy probe")
    else:
        code, output = run_hook(worktree, env)

    head_after = run_git(["rev-parse", "HEAD"], worktree).stdout.strip()
    failed = code != 0
    ok = failed if scenario.expect_failure else not failed
    if scenario.expect_failure and head_before != head_after and scenario.name != "healthy_commit":
        ok = False
        detail = "HEAD moved on a rejection probe"
    elif not scenario.expect_failure and scenario.name == "healthy_commit" and code != 0:
        ok = False
        detail = "healthy commit blocked"
    elif not scenario.expect_failure and scenario.name == "healthy_commit":
        ok = code == 0
        detail = "git commit --allow-empty succeeded"
    else:
        snippet = output.strip().splitlines()[-1] if output.strip() else "(no output)"
        detail = snippet[:240]

    return Result(scenario.name, scenario.expect_failure, code, ok, detail)


def main() -> int:
    source = Path(run_git(["rev-parse", "--show-toplevel"], Path.cwd()).stdout.strip())
    subprocess.run(
        [sys.executable, "-B", "scripts/pre-commit.py", "--self-test"],
        cwd=source,
        check=True,
    )
    print("pre-commit helper self-test passed", flush=True)
    owned = Path(tempfile.mkdtemp(prefix="surety-l1-gate-suite-"))
    worktree = owned / "wt"
    try:
        run_git(["worktree", "add", "--detach", str(worktree), "HEAD"], source)
        link_dependencies(source, worktree)
        results: list[Result] = []
        for scenario in SCENARIOS:
            results.append(exercise_scenario(worktree, scenario))

        print("L1 pre-commit gate self-test", flush=True)
        failures = 0
        for result in results:
            status = "PASS" if result.ok else "FAIL"
            if not result.ok:
                failures += 1
            print(
                f"  {status} {result.name}: exit={result.exit_code} "
                f"expect_fail={result.expect_failure} — {result.detail}",
                flush=True,
            )
        if failures:
            print(f"\n{failures} scenario(s) failed", file=sys.stderr)
            return 1
        print(f"\nAll {len(results)} scenarios passed", flush=True)
        return 0
    finally:
        run_git(["worktree", "remove", "--force", str(worktree)], source, check=False)
        shutil.rmtree(owned, ignore_errors=True)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, subprocess.CalledProcessError, RuntimeError) as error:
        print(f"l1-gate-self-test failed: {error}", file=sys.stderr)
        sys.exit(1)
