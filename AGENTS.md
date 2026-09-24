# Surety

Private family insurance, assets and medical records in a self-hosted Worker with web and CLI clients.
Profile: ts-worker-web + ts CLI.
Human overview: [README.md](README.md). Direction: [design overview](docs/01-design-overview.md). Frameworks must preserve this handbook. Maintain this root `AGENTS.md` as the only project handbook; do not create a `CLAUDE.md` alias, copy or import.

## Sources of Truth

This file is the quality contract; hooks, CI and config are enforcement. Close implementation gaps without lowering the contract. Historical test results are not evidence of a current passing run.

| Fact | Where |
|---|---|
| Product / boundaries | [README.md](README.md), [development](docs/20-development.md) |
| CLI / operations | [CLI contract](apps/cli/README.md), [agent operations](docs/21-agent-operations.md) |
| Version / schema | root `package.json`, shared version export, `packages/db/src/schema.ts` |
| Enforcement / isolation | `vitest.config.ts`, `scripts/pre-*.ts`, `scripts/run-l2-http.ts`, Playwright and CI |
| Accidents | [Retrospective.md](Retrospective.md) |
| Machine workflow | global `AGENTS.md` and Git rules |

## Project Invariants

- One instance serves a shared family dataset, not per-email tenants. Web and CLI use HTTP only; the Worker owns D1/R2. Keep request-scoped repository factories.
- Keep business rules in shared API functions where applicable and entity routing in Worker; preserve policy state transitions, attachment limits and same-origin write checks.
- Separate APP dev hostname, Access-protected login hostname and Bearer API hostname. `SURETY_LOGIN_URL` never points at the dev host; API and login config remain independent.
- Vite dev may write to the live API via `SURETY_DEV_API_TOKEN`; do not use its default proxy for tests. Fixture credentials and family data must remain separate.
- JSON backup excludes R2 files and API tokens and may contain sensitive settings; current D1 restore is incomplete. Never present an export as a verified full restore.
- Use numbered docs, keep the README structure current, and preserve runtime boundaries: Bun-only APIs belong in Bun processes, not Worker/browser code.

## Stack / Layout

| Component | Path / choice |
|---|---|
| UI / Worker | `apps/web` Vite/React/Basalt → `apps/worker` Hono + SPA assets |
| Logic / database | `packages/api`, `packages/db`; D1 binding/Drizzle, in-memory test driver |
| CLI | `apps/cli`, Bun-only `@nocoo/surety`, Bearer auth |

## Commands

Run from root with Bun, Node 22.12+, gitleaks, OSV and installed Playwright Chromium. Unit tests use in-memory SQLite; managed HTTP/browser runners seed only local D1/R2. Old root env examples contain obsolete NextAuth/proxy fields; use current development docs.

```bash
bun install --frozen-lockfile
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

| Dimension | Status | Required proof and current evidence/gap |
|---|---|---|
| L1 TypeScript (incl. former G1 static) | planned | Preserve the stricter all-four 95.5% thresholds in Vitest. Shared packages, TSX, Worker routes and several CLI/hook modules are outside coverage; full source scope remains incomplete. Hooks/CI run zero-warning Biome and all package types; pre-commit runs staged gitleaks/lint/typecheck/coverage check-only against an isolated index snapshot with fresh temporary cache dirs. |
| L2 Worker / CLI | planned | Separate Bun in-process SQLite E2E and real HTTP local D1/R2 lanes run before push. Require 100% endpoint/auth/error coverage and real CLI command workflows; in-process Hono calls are not HTTP proof. |
| L3 browser / CLI | planned | CI runs Chromium against built SPA/local Worker on 27012. All-page and CLI system proof remains incomplete; token login/revocation and real restore need explicit acceptance. |
| G2 | planned | OSV runs before push and CI scans secrets/deps, but local pre-push gitleaks scans only the staged index, missing already committed push contents. |
| D1 | planned | L2/L3 force local persist state and test auth vars, but fixed directories are recursively removed without checked marker/path ownership and runners do not force NODE_ENV=test. |

Pre-commit exports the index to an isolated temporary snapshot, links dependencies and runs staged gitleaks, lint, typecheck and coverage check-only in that order, with no autofix; pre-commit uses fresh isolated temporary cache dirs and never short-circuits via a result cache. Pre-push runs units, in-memory E2E, real local HTTP, OSV and staged gitleaks in parallel. CI independently builds, checks coverage/types/security, HTTP and browser lanes.

Target hooks: pre-commit checks unified L1 (types, check-only lint, coverage) against the index snapshot (`git checkout-index`) in <30s; pre-push checks L2 and G2 in parallel against every stdin push ref/commit in <3min, plus build where applicable. L3 runs in CI or an explicit manual lane.
Never bypass commit/push hooks, force-push, or use autofix in checks. Documentation changes do not authorize deploying or implementing new gates.

## Resources / Isolation

Dev: trusted `https://surety.dev.hexly.ai` → Vite 7012; local Worker 7016. L2: 7017 with `apps/worker/.wrangler/state-l2-http`; L3: 27012 with `.wrangler/state-l3`, no server reuse. Serialize fixed-state runs. Require unique per-run SQLite/R2, `NODE_ENV=test`, checked fixture marker and canonical-path/ownership guards before cleanup. Never remote test provisioning or production seed.

## Operations / Release

Schema push writes the chosen remote D1 directly and is not a startup/test step; schema must be ready before authorized Worker release. Follow [operations](docs/21-agent-operations.md) and current release workflow: build SPA, synchronize root version/changelog/lockfile, then release. Inspect mirror URL drift before publishing; CLI has no separate build.

## Retrospective

Move accident narratives to [Retrospective.md](Retrospective.md); keep at most about ten concise recurring project rules here. Put architecture and operational detail in linked docs.

- Cross-database imports must name columns explicitly; never depend on SQLite `.dump` column order.
- Drizzle sqlite-proxy get returns a flat row; all returns a row array. Verify actual driver contracts.
- `logout` output does not prove token revocation, and `SURETY_CLI_DEV` only changes the config file.
- Set up test guards before removing old infrastructure; keep historical remote-test instructions in the retrospective.
