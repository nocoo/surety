# Deferred Optimizations

## pre-push (e2e, ~30s+)
- **Parallelize osv-scanner + e2e**: implemented in `scripts/pre-push.ts` (overlaps the 4s osv network call with the long e2e run). Real-world saving ≈ min(osv, e2e) ≈ 4s. Hard to benchmark locally without spinning the test D1.
- **Cache osv-scanner result keyed by bun.lock hash**: skip scan when lockfile unchanged since last successful run. Could go from 4s to <50ms on warm pushes.
- **E2E warm dev server**: keep a long-lived dev server bound to the test D1 across runs (LRU process cache). Saves Next.js boot time per push (currently ~3-5s).
- **E2E shard by tag**: split smoke vs full e2e — pre-push runs smoke, CI runs full.

## pre-commit (~1.4s wall, dominated by test 1.4s)
- **Skip coverage on pre-commit, gate on pre-push**: would drop test step from 1.4s to 1.1s (cold) or ~150ms (no-coverage). Coverage instrumentation loads all 125 covered files even when not under test. **Requires updating CLAUDE.md guarantee.**
- **Move typecheck to incremental watch daemon** (e.g. `tsc --watch`) shared between editor + hook. Saves 0.9s per commit but adds infra.
- **Bun coverageThreshold**: exists in docs but did NOT gate exit code in this Bun version (verified: artificially set 0.999, still exited 0). When Bun fixes this we can drop scripts/check-coverage.ts wrapper.
- **lint-staged is much faster than full repo lint**: bench uses `bun run lint` (full repo, 4s cold / 0.65s warm), but real hook uses lint-staged on staged files only — likely <200ms in practice. The bench overstates lint cost.

## further pre-commit ideas tried but not landed
- **`assumeChangesOnlyAffectDirectDependencies: true` in tsconfig**: makes incremental typecheck slightly faster (910→850ms warm), but typecheck is not the wall pole — test is.
- **Direct binary calls** (`./node_modules/.bin/tsc`, `./node_modules/.bin/eslint`) instead of `bun run`: saves ~20-50ms each but lost in macOS process startup noise.
- **Split bun test into 2 parallel procs (src vs mcp) + lcov merge**: real speedup possible (mcp ~400ms could overlap src ~900ms) but requires lcov-result-merger dependency and a custom coverage parser. Worth it if total_ms needs to drop below 800ms.

## Parallel test split — investigated, complications
- Implemented prototype `scripts/check-coverage-parallel.ts` running `bun test src/__tests__` and `bun test mcp/__tests__` in parallel + merging lcov reports.
- Wall clock: ~700ms (vs 1000ms unified) — real ~300ms saving.
- BLOCKER: lcov line counts ≠ text reporter line counts. Unified text reports 93.72% lines, unified lcov says 92.27%, merged-split lcov says 90.37%. Real coverage is unchanged but the *measurement* drifts ~3%.
- To land safely: either (a) accept the lcov drift and lower threshold to 87%; (b) keep text reporter and parse %Lines from each subprocess separately + compute file-weighted average; (c) wait for Bun's `coverageThreshold` to actually gate exit code.
- Removed the prototype to avoid cluttering scripts/. See git history `3e5ec72..HEAD` for context.

## Final session summary (pre-commit/pre-push optimization)

Baseline: 6087ms wall (sequential pre-commit)
Final: ~945ms wall (parallel + cached + concurrent)
**Total improvement: -84%**

Real-world warm pre-commit (with lint-staged on no staged files): ~1.06s wall.

Wall is now bound by `max(test, typecheck) ≈ 0.95s`:
- `bun test --coverage` ≈ 950ms (Bun startup + module load + scrypt-bound TOTP tests)
- `tsc --noEmit` ≈ 900ms (parsing 1500 files including types)
- `eslint --cache` ≈ 600ms (warm; sub-200ms in real lint-staged use)

Pre-push parallelization (osv + gitleaks + e2e) saves real-world ~4s by overlapping the osv-scanner network call with the long e2e run.

## UT coverage gate (segment 6 — 2026-04)
- Wall is **57-62ms steady** (down from 98ms baseline; -42%). Bun startup ~10ms + parallel max ≈ 50ms cli pole.
- All 3 groups now 100/100 (web, worker, cli).
- **Long pole**: cli at ~50ms because policies-coverage.test.ts (36ms) + policies.test.ts (38ms) load + run inside one bun proc.
- **Latest win** (run #48): Hoisted Bun.spawn calls to top-level of check-coverage.ts — the 3 child procs start before the rest of the script parses. Saves ~3-5ms by overlapping spawn syscall with script JIT.
- **Tried, no win** (all within ±3-5ms noise band):
  - `--concurrent` flag on cli tests, `describe.concurrent` on middleware
  - unified single-proc test (85ms vs 53ms parallel — slower)
  - `Bun.readableStreamToText` + parallel drain
  - `process.execPath` instead of "bun" string for spawn
  - `Bun.spawn` with `stdout: Bun.file(tmpPath)` (file IO instead of stream drain)
  - bash wrapper instead of bun script
  - merge cli files (8 vs 9), merge web+worker into one shard
  - `bun build --compile` standalone binary (PATH lookup fails for spawn)
  - cli sharding by file (max(shard A, shard B) ≈ 48ms ≈ same)
  - shebang exec (env lookup adds overhead)
  - 3 explicit Bun.spawn statements vs .map (cli-first ordering didn't help)
  - `--max-concurrency=1` / `=64` (no diff)
  - skipping `bun run` wrapper in test:coverage script (1-2ms saved, lost in noise)
  - dropping `cwd: repoRoot` from spawn options (no diff)
  - `--smol`, `BUN_RUNTIME_TRANSPILER_CACHE_PATH`, `NODE_NO_WARNINGS` (no effect)
  - `coverageThreshold` in bunfig (Bun 1.3.11 doesn't gate exit code)
- **Untried, but unlikely worth it**:
  - Per-test stdout capture in policies-coverage.test.ts → describe.concurrent (tests <0.5ms each, concurrency overhead > savings)
  - mtime-cache the gate (banned: "不能跳过测试")
  - long-lived bun test --watch daemon (significant infra)
- **Conclusion**: ~57ms is the hardware floor. The 50ms cli pole = ~10ms bun startup + ~40ms test/module work. To break 50ms wall would need to either (a) cache test runs by hash (banned), or (b) eliminate parent script entirely so wall == cli proc (52ms).
