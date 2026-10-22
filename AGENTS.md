# Surety

Private family insurance, assets and medical records in a self-hosted Worker with web and CLI clients.
Profile: ts-worker-web + ts CLI.
Human overview: [README.md](README.md). Direction: [design overview](docs/01-design-overview.md). Frameworks must preserve this handbook. Maintain this root `AGENTS.md` as the only project handbook; do not create a `CLAUDE.md` alias, copy or import.

## Sources of Truth

This file is the quality contract; hooks, CI and config are enforcement. Close implementation gaps without lowering the contract. Historical test results are not evidence of a current passing run.

| Fact                    | Where                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Product / boundaries    | [README.md](README.md), [development](docs/20-development.md)                           |
| CLI / operations        | [CLI contract](apps/cli/README.md), [agent operations](docs/21-agent-operations.md)     |
| Version / schema        | root `package.json`, shared version export, `packages/db/src/schema.ts`                 |
| Enforcement / isolation | `vitest.config.ts`, `scripts/pre-*.ts`, `scripts/run-local-tests.ts`, Playwright and CI |
| Accidents               | [Retrospective.md](Retrospective.md)                                                    |
| Machine workflow        | global `AGENTS.md` and Git rules                                                        |

## Project Invariants

- One instance serves a shared family dataset, not per-email tenants. Web and CLI use HTTP only; the Worker owns D1/R2. Keep request-scoped repository factories.
- Keep business rules in shared API functions where applicable and entity routing in Worker; preserve policy state transitions, attachment limits and same-origin write checks.
- Separate APP dev hostname, Access-protected login hostname and Bearer API hostname. `SURETY_LOGIN_URL` never points at the dev host; API and login config remain independent.
- Local startup defaults to persistent synthetic Demo. Only explicit/saved interactive Prod uses `SURETY_DEV_API_TOKEN`; automated launchers force isolated E2E and never inherit Production credentials. See [local environments](docs/22-local-environments.md).
- JSON backup excludes R2 files and API tokens and may contain sensitive settings; current D1 restore is incomplete. Never present an export as a verified full restore.
- Use numbered docs, keep the README structure current, and preserve runtime boundaries: Bun-only APIs belong in Bun processes, not Worker/browser code.

## Stack / Layout

| Component        | Path / choice                                                            |
| ---------------- | ------------------------------------------------------------------------ |
| UI / Worker      | `apps/web` Vite/React/Basalt → `apps/worker` Hono + SPA assets           |
| Logic / database | `packages/api`, `packages/db`; D1 binding/Drizzle, in-memory test driver |
| CLI              | `apps/cli`, Bun-only `@nocoo/surety`, Bearer auth                        |

## Commands

Run from root with Bun, Node 22.12+, gitleaks, OSV and installed Playwright Chromium. Unit tests use in-memory SQLite; managed HTTP/browser runners seed only local D1/R2. Use the root local launcher; workspace dev/preview commands delegate to it.

```bash
bun install --frozen-lockfile
bun run dev --mode demo
bun run dev --mode e2e
bun run demo:reset
bun run test:environments
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun test apps/worker/__tests__/e2e --path-ignore-patterns __none__
bun run test:l2:http
bun run test:e2e:browser
bun run test:cli
```

## Verification

6DQ = L1/L2/L3 + G2 + D1 (test isolation); the former G1 dimension was merged into L1 on 2026-09-21. Status: `enforced`, `planned`, `manual`, or `N/A`; partial enforcement below does not certify the full required bar.
L1 requires statements, branches, functions and lines each ≥95%, with no skipped/focused tests; preserve any stricter package threshold. Native tools must identify unmeasured metrics as gaps. L1 also includes check-only strict analysis/formatting with zero errors/warnings (the former G1 contract). G2 requires dependency and secret scans, with missing required scanners failing.

| Dimension                              | Status  | Required proof and current evidence/gap                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 TypeScript (incl. former G1 static) | planned | Preserve the stricter all-four 95.5% thresholds in Vitest. Shared packages, TSX, Worker routes and several CLI/hook modules are outside coverage; full source scope remains incomplete. Hooks/CI run zero-warning Biome and all package types; pre-commit runs staged gitleaks/lint/typecheck/coverage check-only against an isolated index snapshot with fresh temporary cache dirs. |
| L2 Worker / CLI                        | planned | Separate Bun in-process route units and real HTTP local D1/R2 lanes run before push. Require 100% endpoint/auth/error coverage and real CLI command workflows; in-process Hono calls are not HTTP proof.                                                                                                                                                                              |
| L3 browser / CLI                       | planned | CI runs Chromium against built SPA/native local Worker on dynamic ports. All-page and CLI system proof remains incomplete; token login/revocation and real restore need explicit acceptance.                                                                                                                                                                                          |
| G2                                     | planned | OSV runs before push and CI scans secrets/deps, but local pre-push gitleaks scans only the staged index, missing already committed push contents.                                                                                                                                                                                                                                     |
| D1                                     | planned | Managed L2/L3 use unique native stores, NODE_ENV=test, allowlisted child env, signed fixture identities, canonical-path/UID/marker checks and owned cleanup. Environment verification covers manual switching, lock enforcement and foreign cleanup refusal. Abrupt SIGKILL recovery remains manual.                                                                                  |

Pre-commit exports the index to an isolated temporary snapshot, links dependencies and runs staged gitleaks, lint, typecheck and coverage check-only in that order, with no autofix; pre-commit uses fresh isolated temporary cache dirs and never short-circuits via a result cache. Pre-push runs units, in-process route units, real local HTTP, OSV and staged gitleaks in parallel. CI independently builds, checks coverage/types/security, HTTP and browser lanes.

Target hooks: pre-commit checks unified L1 (types, check-only lint, coverage) against the index snapshot (`git checkout-index`) in <30s; pre-push checks L2 and G2 in parallel against every stdin push ref/commit in <3min, plus build where applicable. L3 runs in CI or an explicit manual lane.
Never bypass commit/push hooks, force-push, or use autofix in checks. Documentation changes do not authorize deploying or implementing new gates.

## Resources / Isolation

Dev: trusted `https://surety.dev.hexly.ai` → local launcher 7012. Worker and automated
frontend ports are dynamic. Demo persists under `.surety-local/demo`; each E2E
owns `.surety-local/runs/<uuid>`. Only `--automated` locks switching. Test/capture
verification uses separate owned Demo storage and never resets daily Demo.
Commands and feature/fixture matrix: [local environments](docs/22-local-environments.md).
Never remote test provisioning or production seed.

## Operations / Release

The explicit `db:migrate` command applies the shared SQL migrations remotely and is not a startup/test step; inspect existing schema/history before the first authorized baseline application. Schema must be ready before an authorized Worker release. Follow [operations](docs/21-agent-operations.md) and current release workflow: build SPA, synchronize root version/changelog/lockfile, then release. Inspect mirror URL drift before publishing; CLI has no separate build.

| Area                   | Facts                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release                | `bun run build` (SPA → `apps/worker/static`); `bun run release [-- patch\|minor\|major\|X.Y.Z\|--dry-run]` (`scripts/release.ts`: root version, `bun.lock`, CHANGELOG, commit, tag, GitHub release); keep `apps/cli/package.json` version in sync. Manual Worker deploy only when authorized: `bun run --cwd apps/worker deploy` (`wrangler deploy`). |
| CLI publish            | `@nocoo/surety` from `apps/cli`, published from 哥's MacBook (2FA in Chrome); verify/install via `https://registry.npmmirror.com`.                                                                                                                                                                                                                    |
| CI (`ci.yml`)          | `quality` (base-ci): `bun run build`, `bun run typecheck`, `bun run test:coverage`, L2 `bun run test:l2:http`; `L3 Browser E2E`: `bun run test:e2e:browser` (chromium).                                                                                                                                                                               |
| Deploy (`release.yml`) | `Deploy Worker` on green CI on `main`, `v*.*.*` tag or dispatch; builds, wrangler deploy from `apps/worker`, verifies `https://surety.hexly.ai/api/live` version.                                                                                                                                                                                     |
| Targets                | Worker `surety`, custom domains `surety.hexly.ai` (SPA + Access login) and `surety-api.hexly.ai` (Bearer API); D1 `DB` → `surety-db`; R2 `ATTACHMENTS` → `surety`; assets `ASSETS`; npm `@nocoo/surety`.                                                                                                                                              |

## Retrospective

Move accident narratives to [Retrospective.md](Retrospective.md); keep at most about ten concise recurring project rules here. Put architecture and operational detail in linked docs.
- Cross-database imports must name columns explicitly; never depend on SQLite `.dump` column order.
- Drizzle sqlite-proxy get returns a flat row; all returns a row array. Verify actual driver contracts.
- `logout` output does not prove token revocation, and `SURETY_CLI_DEV` only changes the config file.
- Set up test guards before removing old infrastructure; keep historical remote-test instructions in the retrospective.
