# 23 · Quality Gates and Verification Baseline

Detailed quality slot boundaries, local hook mechanics, rejection probes, and measured baselines offloaded from [AGENTS.md](../AGENTS.md).
CI machine source of truth: [.github/workflows/quality-slots.yml](../.github/workflows/quality-slots.yml) (`quality / Z1: Gate`).
Local runtime isolation details: [Local Environments](22-local-environments.md).

## Quality Slot Baseline

Status vocabulary: `enforced`, `planned`, `manual`, `N/A`. Historical test runs are not evidence of a current passing run; partial checks do not certify unrun slots.

| Slot              | Status     | Implementation and current boundary / gap                                                                                                                                                                                                            |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S1 Types`        | `enforced` | `bun run typecheck` across root, `apps/web`, `apps/cli`, and `apps/worker` (CI + pre-commit).                                                                                                                                                        |
| `S2 Lint`         | `enforced` | `bun run lint` (`biome check --error-on-warnings .`), check-only, 0 errors / 0 warnings, no autofix (CI + pre-commit).                                                                                                                               |
| `S3 Workflow`     | `enforced` | CI verifies every external GitHub Action in `.github/workflows/*.yml` is pinned to a 40-char SHA.                                                                                                                                                    |
| `G1 Secrets`      | `enforced` | `gitleaks detect` in CI; `gitleaks protect --staged` in pre-commit and pre-push (missing scanner fails the gate).                                                                                                                                    |
| `G2 Dependencies` | `enforced` | `osv-scanner --config osv-scanner.toml --lockfile=bun.lock` in CI and pre-push; local pre-push reads worktree lockfile instead of per-ref OIDs (`planned` gap).                                                                                      |
| `B1 Build`        | `enforced` | `bun run build` writes SPA to `apps/worker/static` in CI; adding `B1` to local pre-push is `planned`.                                                                                                                                                |
| `L1 Unit`         | `enforced` | `bun run test:coverage` enforces 95.5% floors across statements, branches, functions, and lines with 0 skipped/focused tests on the `vitest.config.mts` scope; CI also runs `L1: Unit (Pre-commit Gate)`.                                            |
| `L2 Runtime`      | `N/A`      | Cloudflare Worker runtime bindings are exercised via `L3`/`L4`. In-process Hono route tests (`bun test apps/worker/__tests__/e2e --path-ignore-patterns __none__`) run in pre-push as unit-level evidence only, not HTTP proof.                      |
| `L3 Integration`  | `enforced` | `bun run test:l2:http` runs real HTTP against local Wrangler with fresh native D1/R2 on dynamic ports (CI + pre-push). Expanding to 100% endpoint/auth/error permutations and real CLI command workflows remains `planned`.                          |
| `L4 E2E`          | `enforced` | `bun run test:e2e:browser` runs Playwright Chromium against built SPA + native local Worker on dynamic ports in CI. Full all-page/CLI system proof remains `planned`; interactive Access login/token revocation and real D1 restore remain `manual`. |
| `P1 Package`      | `planned`  | `@nocoo/surety` npm tarball install and import check (`vars.ENABLE_P1_PACKAGE == 'true'` placeholder in CI).                                                                                                                                         |
| `Z1 Gate`         | `enforced` | `quality / Z1: Gate` requires `S1`, `S2`, `S3`, `G1`, `G2`, `B1`, `L1`, `L3`, `L4`, and `L1: Unit (Pre-commit Gate)` on `main`.                                                                                                                      |

### L1 Coverage Scope (`vitest.config.mts`)

Vitest measures `apps/web/src/**`, `apps/worker/src/**`, and `apps/cli/src/**` with 95.5% floors on statements, branches, functions, and lines. By design, `vitest.config.mts` excludes:

- Worker HTTP routes (`apps/worker/src/routes/**`) and D1 Hono middleware (`apps/worker/src/middleware/db.ts`) — covered by `L3`.
- Build-time `bun:sqlite` stub (`apps/worker/src/lib/bun-sqlite-stub.ts`).
- Declarative CLI CRUD wrappers (`apps/cli/src/commands/{assets,doctors,hospitals,insurers,medical-visits,members}.ts`) and interactive browser login (`apps/cli/src/commands/auth.ts`).
- TSX components/views (`**/*.tsx`), browser-API hooks/helpers (`apps/web/src/hooks/**`, `upload-with-progress.ts`, `utils.ts`), and pure config/constants (`chart-config.ts`, `constants/**`).

## Pre-commit Index-Snapshot Gate

`.husky/pre-commit` executes `scripts/pre-commit.py` straight from the Git index (`git show :scripts/pre-commit.py`). Execution model:

1. Exports the staged index (`git checkout-index --all --force`) into an isolated temporary directory.
2. Symlinks workspace `node_modules` into the snapshot, rewriting local workspace symlinks so imports resolve inside the snapshot rather than the working tree.
3. Creates fresh isolated `TMPDIR`, `XDG_CACHE_HOME`, and `BUN_INSTALL_CACHE_DIR` per run; never short-circuits via a result cache and never runs autofix.
4. Runs under a 170s total deadline in strict order: `scripts/pre-commit.py --self-test` -> `gitleaks protect --staged` -> `bun run lint` -> `bun run typecheck` -> `bun run test:coverage --allowOnly=false`.
5. Validates Vitest JSON test output (non-empty, 0 failed/pending/todo) and `coverage-summary.json` (all 4 metrics finite and >= 95.5%).

### Measured Pre-commit Baseline (2026-11-09)

Recorded reference run of `python3 -B scripts/pre-commit.py` on an index snapshot (for latency tracking only, not current pass proof):

- **Latency**: cold ~8.9s, warm ~8.3-8.7s (<30s target).
- **Steps**: `gitleaks` -> `lint` -> `typecheck` -> `test:coverage` all exited 0.
- **Coverage**: 98.85% statements / 97.84% branches / 97.76% functions / 99.41% lines.
- **Tests**: 412/412 passed, 0 skipped, 0 focused.

### Rejection Probes (`bun run test:l1:gate`)

`scripts/l1-gate-self-test.py` (CI job `L1: Unit (Pre-commit Gate)`) verifies that the pre-commit gate rejects failures in disposable Git worktrees:

- Unit test failure
- Each individual coverage metric falling below 95.5% (statements, branches, functions, lines)
- Lint error and lint warning
- TypeScript type error
- Focused (`.only`) and skipped (`.skip`) tests
- Index-vs-worktree mismatch (unstaged fix cannot mask staged breakage)
- Missing `gitleaks` binary
- Timeout enforcement and `SIGINT` handling

Malformed JSON test and coverage report validation is additionally checked by `python3 -B scripts/pre-commit.py --self-test`.

## Pre-push Hook and Target Contract

`.husky/pre-push` runs `scripts/pre-push.ts`, executing five read-only checks in parallel:

1. `osv-scanner --lockfile=bun.lock`
2. `gitleaks protect --staged --no-banner`
3. `bunx vitest run`
4. `bun test apps/worker/__tests__/e2e --path-ignore-patterns __none__` (in-process route units)
5. `bun --no-env-file scripts/run-local-tests.ts http` (`test:l2:http`)

### Known Gaps vs Target Hooks

- **Target pre-commit**: check `S1`, `S2`, `G1`, and `L1` against the staged index snapshot in <30s (`enforced`).
- **Target pre-push**: check `G2`, `B1`, `L3`, and `P1` in parallel against every stdin push ref / local OID in <3min (`planned` gaps: current `scripts/pre-push.ts` does not iterate stdin refs, scans only staged index with `gitleaks` missing already-committed push contents, and omits `B1 Build` and `P1 Package`).
- **Isolation & recovery**: managed `L3`/`L4` runners enforce unique native stores, `NODE_ENV=test`, allowlisted child env, signed fixture identities, canonical-path/UID/marker checks, and owned cleanup. `bun run test:environments` verifies manual switching, lock enforcement, and foreign cleanup refusal. Abrupt `SIGKILL` recovery remains `manual`.
- **Gate discipline**: never bypass commit/push hooks, force-push, or run autofix inside verification checks. Documentation changes do not authorize deploying or altering quality gates.
