# Surety

Private family insurance, assets, and medical records on a self-hosted Cloudflare Worker (`apps/worker`: Hono API + Vite/React/Basalt SPA from `apps/web`), shared `packages/api` & `packages/db` (Drizzle/D1 + in-memory test driver), and Bun-only CLI (`apps/cli`, `@nocoo/surety`).
Docs: [README.md](README.md) · [Design](docs/01-design-overview.md) · [Development](docs/20-development.md) · [Operations](docs/21-agent-operations.md) · [Local Environments](docs/22-local-environments.md) · [Quality Gates](docs/23-quality-gates.md) · [CLI](apps/cli/README.md) · [Retrospective](Retrospective.md)

## Commands

Run from root with Bun, Node 22.12+, `gitleaks`, `osv-scanner`, and installed Playwright Chromium. Local env names live in `.env.example`. Unit tests use in-memory SQLite; managed HTTP/browser runners seed only local D1/R2. Use the root local launcher; workspace dev/preview scripts delegate to it.

```sh
bun install --frozen-lockfile
bun run dev --mode demo          # https://surety.dev.hexly.ai -> 127.0.0.1:7012 (default persistent Demo)
bun run dev --mode e2e           # interactive E2E, freely switchable
bun run demo:reset               # stop launcher first; resets owned Demo only
bun run test:environments        # local isolation, switching, and disposable captures
bun run typecheck                # S1 (root + web + cli + worker)
bun run lint                     # S2 Biome check-only, 0 warnings
bun run build                    # B1 SPA -> apps/worker/static (CLI has no build)
bun run test:coverage            # L1 Vitest >= 80% (4 metrics on configured scope)
bun run test:l1:gate             # L1 pre-commit rejection probes in disposable worktrees
bun test apps/worker/__tests__/e2e --path-ignore-patterns __none__  # in-process Hono route units (not HTTP proof)
bun run test:l2:http             # L3 real HTTP against fresh local Wrangler D1/R2
bun run test:e2e:browser         # L4 Chromium against built SPA + native local Worker
bun run test:cli                 # CLI unit suite
```

## Invariants

- **Shared family dataset**: One instance serves one shared family dataset, not per-email tenants. Web and CLI use HTTP only; the Worker owns D1/R2 via request-scoped repository factories.
- **Domain & write safety**: Keep business rules in `packages/api`, entity routing in `apps/worker`; preserve policy transitions, attachment limits (PDF/JPEG/PNG <=50 MiB, <=20/policy), and same-origin writes.
- **Three-domain auth**: Keep APP dev (`surety.dev.hexly.ai`), Access login (`surety.hexly.ai`), and Bearer API (`surety-api.hexly.ai`) separate; `SURETY_LOGIN_URL` never points at the dev host.
- **Local credentials**: Dev defaults to persistent synthetic Demo; only explicit/saved interactive Prod uses `SURETY_DEV_API_TOKEN`. Automated launchers force isolated E2E without Prod credentials.
- **Backup & restore**: JSON backup excludes R2 files and API tokens and may expose sensitive settings; current D1 restore is incomplete. Never present a JSON export as a verified full restore.
- **Runtime & authority**: Keep Bun-only APIs out of Worker/browser code. Root `package.json` (`APP_VERSION`), `packages/db/src/schema.ts`, and `apps/worker/migrations/` are authoritative; sync CLI version.
- **Database & drivers**: Name columns explicitly in cross-DB imports (never trust `.dump` order). Verify Drizzle driver contracts (D1 vs `bun-sqlite`; `sqlite-proxy` get=flat row, all=rows).
- **CLI auth quirks**: `logout` output does not prove token revocation, and `SURETY_CLI_DEV` only switches the config file (`config.dev.json`), not the API URL.
- **Docs & infra**: Use numbered docs in `docs/` and keep `README.md` current. Add safety test guards before removing old infrastructure; never bypass hooks or use autofix in checks.
- **Remote migrations**: `bun run db:migrate` applies remote D1 migrations and is never a startup/test step; inspect remote schema/history with authorization first. Schema must be ready before deploy.
- **Releases & deploy**: Releases (`bun run release`), Worker deploys, and CLI publishes require authorization; inspect `bun.lock` for mirror URL drift first. See [Operations](docs/21-agent-operations.md).

## Quality & Local Gates

Follows `system1-quality`; CI slot definitions and pinned `base-ci` revision live in `.github/workflows/quality-slots.yml` (`quality / Z1: Gate` required on `main`). Status vocabulary: `enforced`, `planned`, `manual`, `N/A`. Historical runs are not current pass evidence; details and measured baselines live in [Quality Gates](docs/23-quality-gates.md).

- **L1 scope & probes**: `vitest.config.mts` enforces 80% four-metric floors (0 skipped/focused), excluding Worker routes, Views/TSX/hooks, CLI CRUD wrappers, and `auth.ts`.
- **Exceptions / gaps**: `L2 Runtime` is `N/A` (Worker covered by `L3`/`L4`; in-process route tests are unit-only). `P1 Package` is `enforced` in CI via `wrangler deploy --dry-run` on the `B1` Worker/SPA bundle (`@nocoo/surety` CLI tarball check remains `planned`).
- **Coverage gaps**: `L3` and `L4` are `enforced` in CI, while 100% endpoint/error permutations and full CLI system proof remain `planned`; Access login/revocation and real D1 restore remain `manual`.
- **Pre-commit**: Installed via `bun run prepare` (`.husky/`); `scripts/pre-commit.py` runs `gitleaks`, `lint`, `typecheck`, and `test:coverage` on an isolated index snapshot with fresh caches and no autofix.
- **Pre-push**: `scripts/pre-push.ts` runs `osv-scanner`, staged `gitleaks`, Vitest, route units, and `test:l2:http` in parallel (`planned`: check all stdin push refs, committed secrets, and `B1 Build`).

## Resources & Isolation

| Lane        | Endpoint / State                                                                | Boundary                                                                                               |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dev (Demo)  | `https://surety.dev.hexly.ai` -> `127.0.0.1:7012`, `.surety-local/demo`         | Persistent synthetic Demo; dynamic Worker port; preserve daily store                                   |
| Tests (E2E) | Dynamic ports, `.surety-local/runs/<uuid>`, `NODE_ENV=test`                     | Fresh native D1/R2, allowlisted env, signed fixture JWTs, owned cleanup; `SIGKILL` recovery `manual`   |
| Prod        | `surety.hexly.ai` (SPA/Access), `surety-api.hexly.ai` (Bearer), Worker `surety` | Read-only unless authorized; D1 `surety-db`, R2 `surety`, `ASSETS`, `@nocoo/surety`; never remote-seed |

Only `--automated` locks mode switching; test/capture runs use separate Demo storage and never reset daily Demo. See [Local Environments](docs/22-local-environments.md).

## Retrospective

Record incident narratives in [Retrospective.md](Retrospective.md); promote recurring project constraints to `Invariants` above and enforceable safeguards to tests/hooks.
