import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

TIMEOUT = 170
METRICS = ("statements", "branches", "functions", "lines")
DEPENDENCIES = (
    "node_modules",
    "apps/cli/node_modules",
    "apps/web/node_modules",
    "apps/worker/node_modules",
    "packages/api/node_modules",
    "packages/db/node_modules",
)
FLOORS = {metric: 95.5 for metric in METRICS}


def environment(temporary):
    env = {key: os.environ[key] for key in ("PATH", "HOME", "LANG", "LC_ALL", "DEVELOPER_DIR", "SDKROOT") if key in os.environ}
    env.update({key: value for key, value in os.environ.items() if key.startswith("GIT_")})
    env.update(
        CI="1",
        NODE_ENV="test",
        TMPDIR=str(temporary / "tmp"),
        XDG_CACHE_HOME=str(temporary / "cache"),
        BUN_INSTALL_CACHE_DIR=str(temporary / "bun-cache"),
        NEXT_TELEMETRY_DISABLED="1",
    )
    for name in ("tmp", "cache", "bun-cache"):
        (temporary / name).mkdir()
    return env


def run(args, cwd, env, deadline, capture=False):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("L1 gate exceeded its total time limit")
    print("pre-commit: " + " ".join(map(str, args)), flush=True)
    command_env = dict(env)
    if args[0] in ("git", "gitleaks"):
        command_env.update({key: value for key, value in os.environ.items() if key.startswith("GIT_")})
    child = subprocess.Popen(
        args,
        cwd=cwd,
        env=command_env,
        start_new_session=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
        text=True,
    )
    try:
        output, _ = child.communicate(timeout=remaining)
        if child.returncode:
            if output:
                print(output, end="", file=sys.stderr, flush=True)
            raise subprocess.CalledProcessError(child.returncode, args)
        return output or ""
    finally:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            child.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait()


def link_dependencies(source, target, root, snapshot):
    root = root.resolve()
    snapshot = snapshot.resolve()
    if not source.is_dir():
        raise RuntimeError(f"Missing installed dependencies: {source}")
    target.mkdir(parents=True, exist_ok=True)
    for entry in source.iterdir():
        if entry.name.startswith(".") and entry.name not in (".bin", ".bun"):
            continue
        destination = target / entry.name
        if entry.name.startswith("@") and entry.is_dir():
            link_dependencies(entry, destination, root, snapshot)
            continue
        resolved = entry.resolve()
        if resolved.is_relative_to(root) and "node_modules" not in resolved.relative_to(root).parts:
            resolved = snapshot / resolved.relative_to(root)
        destination.symlink_to(resolved, target_is_directory=entry.is_dir())


def check_tests(path):
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"Missing Vitest JSON report: {path}")
    report = json.loads(path.read_text())
    total = report.get("numTotalTests")
    passed = report.get("numPassedTests")
    if report.get("success") is not True or type(total) is not int or total <= 0:
        raise RuntimeError(f"Missing, empty, or unsuccessful test report: {path}")
    if (passed != total or report.get("numFailedTests") != 0 or
            report.get("numPendingTests") != 0 or report.get("numTodoTests") != 0):
        raise RuntimeError(f"Failed, skipped, or malformed required test report: {path}")
    print(f"{path.name}: {passed}/{total} tests passed, 0 skipped", flush=True)


def check_coverage(path):
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"Missing Vitest coverage summary: {path}")
    report = json.loads(path.read_text())
    total = report.get("total")
    if not isinstance(total, dict):
        raise RuntimeError(f"Missing total coverage summary: {path}")
    values = {}
    for metric in METRICS:
        result = total.get(metric)
        if not isinstance(result, dict):
            raise RuntimeError(f"Missing {metric} coverage in {path}")
        value = result.get("pct")
        count = result.get("total")
        covered = result.get("covered")
        if (not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100 or
                type(count) is not int or count <= 0 or type(covered) is not int or
                not 0 <= covered <= count or value < FLOORS[metric]):
            raise RuntimeError(f"Missing, malformed, or below-floor {metric} coverage in {path}: {value}")
        values[metric] = value
    print(path.parent.name + " coverage: " + ", ".join(
        f"{metric}={values[metric]:.2f}%" for metric in METRICS
    ), flush=True)


def self_test():
    with tempfile.TemporaryDirectory() as directory:
        base = Path(directory)
        root = base / "repo"
        snapshot = base / "snapshot"
        source = root / "node_modules"
        (source / ".cache").mkdir(parents=True)
        (source / ".bin").mkdir()
        (source / "package").mkdir()
        (root / "workspace").mkdir(parents=True)
        (root / "workspace" / "index.js").write_text("staged")
        (snapshot / "workspace").mkdir(parents=True)
        (source / "package" / "index.js").write_text("dependency")
        (source / "local-package").symlink_to(root / "workspace", target_is_directory=True)
        (source / ".cache" / "secret").write_text("ignored")
        (source / ".bin" / "tool").write_text("binary")
        link_dependencies(source, snapshot / "node_modules", root, snapshot)
        assert not (snapshot / "node_modules" / ".cache").exists()
        assert (snapshot / "node_modules" / ".bin" / "tool").is_file()
        assert (snapshot / "node_modules" / "package").is_symlink()
        assert (snapshot / "node_modules" / "local-package").resolve() == (snapshot / "workspace").resolve()

        report = base / "tests.json"
        report.write_text(json.dumps({"success": True, "numTotalTests": 1, "numPassedTests": 1,
                                      "numFailedTests": 0, "numPendingTests": 0, "numTodoTests": 0}))
        check_tests(report)
        for bad in (
            {"success": True, "numTotalTests": 0, "numPassedTests": 0},
            {"success": True, "numTotalTests": True, "numPassedTests": 1},
            {"success": True, "numTotalTests": 1, "numPassedTests": 0,
             "numFailedTests": 0, "numPendingTests": 1, "numTodoTests": 0},
        ):
            report.write_text(json.dumps(bad))
            try:
                check_tests(report)
            except RuntimeError:
                pass
            else:
                raise AssertionError("Invalid test report was accepted")

        report.write_text(json.dumps({"total": {metric: {"total": 2, "covered": 2, "pct": 100} for metric in METRICS}}))
        check_coverage(report)
        invalid_reports = []
        for value in (95.4, float("nan"), 101):
            invalid_reports.append({"total": {metric: {"total": 2, "covered": 2, "pct": 100} for metric in METRICS}})
            invalid_reports[-1]["total"]["branches"]["pct"] = value
        missing_covered = {"total": {metric: {"total": 2, "covered": 2, "pct": 100} for metric in METRICS}}
        del missing_covered["total"]["branches"]["covered"]
        invalid_reports.append(missing_covered)
        excessive_covered = {"total": {metric: {"total": 2, "covered": 2, "pct": 100} for metric in METRICS}}
        excessive_covered["total"]["branches"]["covered"] = 3
        invalid_reports.append(excessive_covered)
        empty = {"total": {metric: {"total": 2, "covered": 2, "pct": 100} for metric in METRICS}}
        empty["total"]["branches"]["total"] = 0
        invalid_reports.append(empty)
        for bad in invalid_reports:
            report.write_text(json.dumps(bad))
            try:
                check_coverage(report)
            except RuntimeError:
                pass
            else:
                raise AssertionError("Invalid coverage was accepted")
    print("pre-commit helper checks passed", flush=True)


def main():
    started = time.monotonic()
    deadline = started + TIMEOUT
    for tool in ("git", "bun", "node", "python3", "gitleaks"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"Missing required tool: {tool}")

    with tempfile.TemporaryDirectory(prefix="surety-l1-") as temporary_name:
        temporary = Path(temporary_name)
        env = environment(temporary)
        root = Path(run(["git", "rev-parse", "--show-toplevel"], Path.cwd(), env, deadline, capture=True).strip())
        snapshot = temporary / "source"
        snapshot.mkdir()
        run(["git", "checkout-index", "--all", "--force", f"--prefix={snapshot}/"], root, env, deadline)
        for relative in DEPENDENCIES:
            link_dependencies(root / relative, snapshot / relative, root, snapshot)

        run([sys.executable, "-B", "scripts/pre-commit.py", "--self-test"], snapshot, env, deadline)
        for path in ("node_modules/.bin/vitest", "node_modules/.bin/biome", "node_modules/.bin/tsc"):
            if not (snapshot / path).exists():
                raise RuntimeError(f"Missing staged-snapshot tool: {path}")

        run(["gitleaks", "protect", "--staged", "--no-banner",
             "--config", str(snapshot / ".gitleaks.toml")], root, env, deadline)
        run(["bun", "run", "lint"], snapshot, env, deadline)
        run(["bun", "run", "typecheck"], snapshot, env, deadline)

        tests = temporary / "tests.json"
        coverage = temporary / "coverage"
        run(["bun", "run", "test:coverage", "--allowOnly=false", "--reporter=default",
             "--reporter=json", f"--outputFile={tests}", "--coverage.reporter=text",
             "--coverage.reporter=json-summary", f"--coverage.reportsDirectory={coverage}"],
            snapshot, env, deadline)
        check_tests(tests)
        check_coverage(coverage / "coverage-summary.json")
    print(f"L1 pre-commit passed in {time.monotonic() - started:.2f}s", flush=True)


def interrupt(signum, _frame):
    raise SystemExit(128 + signum)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, interrupt)
    signal.signal(signal.SIGTERM, interrupt)
    try:
        if sys.argv[1:] == ["--self-test"]:
            self_test()
        else:
            main()
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError,
            TimeoutError, SystemExit) as error:
        print(f"pre-commit failed: {error}", file=sys.stderr)
        sys.exit(1)
