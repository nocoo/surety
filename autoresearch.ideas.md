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
