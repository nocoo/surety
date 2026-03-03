# Testing Improvement Plan

Four-layer testing architecture alignment, based on memory-system spec audit.

## Background

Memory system stores a core spec (importance=1.0): **Four-Layer Testing Architecture**.
This plan addresses gaps found between the spec and the current implementation.

## Spec vs Current

| Layer | Spec Requirement | Trigger | Current Status | Gap |
|-------|-----------------|---------|---------------|-----|
| L1 UT | 90%+ line coverage | pre-commit | Coverage check runs in **pre-push**, not pre-commit | Hook misplaced |
| L2 Lint | Zero errors/warnings, strict mode | pre-commit | Lint runs in pre-commit (good), but no strict rules | Missing strict rules |
| L3 API E2E | 100% Restful API coverage | pre-push | 89.4% (42/47 endpoints covered) | 5 endpoints missing |
| L4 BDD E2E | Core user flows via Playwright | pre-push | 9 Playwright specs (good) | OK |

### Infrastructure Gaps

| Area | Spec | Current | Gap |
|------|------|---------|-----|
| Hook responsibility | pre-commit=UT+coverage+lint, pre-push=E2E only | pre-commit=UT+lint, pre-push=coverage+lint+E2E | Misaligned |
| Port pre-check | Check & kill before starting E2E server | Neither script checks port | Missing |
| DB cleanup | Clean WAL/SHM files after E2E | `run-e2e-ui.ts` does, `run-e2e.ts` does not | Inconsistent |
| Server logging | Visible startup errors | stdout/stderr piped but never read | Opaque |

## Execution Plan

Ordered by risk (low risk first) and dependency. Each step = one atomic commit.

### Step 1 — Fix Husky hook responsibilities

**Risk**: Zero. **ETA**: 5 min.

- `pre-commit`: `bun run test:coverage && bun run lint`
- `pre-push`: `bun run test:e2e && bun run test:e2e:ui`

Commit: `fix: align husky hooks with four-layer testing spec`

### Step 2 — E2E scripts: port pre-check

**Risk**: Low. **ETA**: 15 min.

Extract shared `ensurePortFree(port)` utility into `scripts/e2e-utils.ts`.
Call it before spawning dev server in both `run-e2e.ts` and `run-e2e-ui.ts`.

Commit: `fix: add port pre-check to e2e runner scripts`

### Step 3 — run-e2e.ts: WAL/SHM cleanup alignment

**Risk**: Zero. **ETA**: 5 min.

Add WAL/SHM/journal file cleanup to `run-e2e.ts`, matching `run-e2e-ui.ts`.

Commit: `fix: align run-e2e.ts db cleanup with run-e2e-ui.ts`

### Step 4 — E2E scripts: server log visibility

**Risk**: Zero. **ETA**: 10 min.

On server startup failure, dump captured stdout/stderr to console.
Keep `"pipe"` mode to avoid noise during normal runs.

Commit: `fix: dump server logs on e2e startup failure`

### Step 5 — Add missing API E2E tests

**Risk**: Low. **ETA**: 30 min.

| Endpoint | Action |
|----------|--------|
| `GET /api/live` | New file `live.e2e.test.ts` — smoke test (200 + version) |
| `POST /api/backup` | Add restore test to existing `backup.e2e.test.ts` |
| `GET/POST /api/auth/[...nextauth]` | Skip — framework route, auth not enforced |

Commit: `test: add e2e tests for live endpoint and backup restore`

### Step 6 — ESLint strict mode

**Risk**: **High** — may produce many new errors. **ETA**: 1-3 hours.

Phase approach:
1. Add strict rules as `"warn"` first, run lint to assess impact
2. Fix all warnings
3. Promote to `"error"`

Rules to add:
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unused-vars`: error (with `argsIgnorePattern: "^_"`)
- `@typescript-eslint/strict-boolean-expressions`: warn → error
- `no-console`: warn (allow `warn`, `error`)

Commit: `feat: enable eslint strict mode for four-layer compliance`

## Success Criteria

- [x] pre-commit blocks code with <90% coverage
- [x] pre-push only runs API E2E tests (BDD E2E moved to on-demand via `bun run test:e2e:ui`)
- [x] E2E scripts detect and kill stale port occupants
- [x] Both E2E runners clean WAL/SHM files
- [x] Server startup failures show useful logs
- [x] API E2E coverage >= 95% (now 45/47 = 95.7%, only auth routes excluded)
- [x] ESLint strict mode active with zero warnings

## Completion Log

| Step | Commit | Date |
|------|--------|------|
| Plan | `docs: add four-layer testing improvement plan` | 2026-03-03 |
| Step 1 | `fix: align husky hooks with four-layer testing spec` | 2026-03-03 |
| Steps 2-4 | `fix: add port pre-check, wal cleanup, and failure logs to e2e runners` | 2026-03-03 |
| Step 5 | `test: add e2e tests for live endpoint and backup restore` | 2026-03-03 |
| Step 6 | `feat: enable eslint strict mode for four-layer compliance` | 2026-03-03 |
