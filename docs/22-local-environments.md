# Local environments

Shared plan: [system0-envs](../../workflow/tasks/system0-envs/SKILL.md).
Implementation: `apps/web/local/`, `apps/worker/local/`, and
`apps/worker/migrations/`. Application version: 2.3.6; fixture catalog:
2026-09-28.2, anchor 2026-09-28, Asia/Shanghai.

## Commands

Run at the repository root with Bun, Node 22.12+, installed dependencies and
Playwright Chromium. No Cloudflare credentials are needed for Demo or E2E.

```bash
bun run dev                         # interactive; saved choice, otherwise Demo
bun run dev --mode demo              # explicit initial choice overrides preference
bun run dev --mode e2e               # interactive E2E, freely switchable
bun run dev --mode prod              # real API; requires SURETY_DEV_API_TOKEN
bun run build
bun run dev:built --mode demo        # same local capability with built SPA
bun run demo:reset                   # stop launcher first; deletes owned Demo only
bun run test:l2:http                 # real HTTP, fresh native D1/R2, signed identity
bun run test:e2e:browser             # Chromium; fresh owned automated E2E
bun run test:environments            # isolation, switching and disposable captures
bun run fixtures:media              # regenerate original PNG/PDF via Chromium
```

The interactive frontend listens on 127.0.0.1:7012, also available through the
existing trusted `https://surety.dev.hexly.ai` reverse proxy. Worker ports are
allocated dynamically. Workspace dev/preview scripts delegate to the same
launcher. Plain hosted Vite bundles have no local switching handler.

For a dedicated, locked capture instance with the rich catalog:

```bash
bun run build
bun --no-env-file apps/web/local/main.ts --automated --built --dataset demo --port 27013
```

Stop with Ctrl-C for owned cleanup. Vite dev/built shutdown hooks await native
cleanup before exit; managed test runners assert their owned store was removed. `test:environments` automatically captures
all 13 routes, desktop/mobile chrome and attachment preview into
`test-results/environments-<uuid>/`, alongside a manifest containing revision,
versions, viewport, locale and anchor. Captures use disposable E2E, not daily
Demo. The test suite also exercises an independent persistent Demo namespace.

## Runtime and safety boundaries

| Mode | Backend and identity                                                     | Lifetime                                                                  |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Demo | Real local Worker/D1/R2; RS256 fixture issuer                            | `.surety-local/demo`; CRUD survives restart; explicit reset               |
| E2E  | Same Worker/API/auth/repositories/migrations; unique RSA issuer audience | `.surety-local/runs/<uuid>`; removed on accepted exit or orderly shutdown |
| Prod | Fixed `https://surety-api.hexly.ai`; real server-side Bearer token       | Real deployed data; never provisioned or reset by these tools             |

The local gateway validates Host and Origin. It creates opaque, immutable
`/__instance/<uuid>/api/…` targets per tab. A switch replaces the session only
after the target is ready. Old requests retain their original target or fail
with 410; they cannot become writes against the new environment. Cookies and
caller-supplied Access assertions are not forwarded. Production credentials
never enter the browser bundle. Production token-management actions still
require a real interactive Access session and cannot be performed with the
local Bearer proxy alone.

`--automated` is launch intent, separate from mode. It forces E2E server-side,
rejects switching, ignores browser preference and removes real-service
credentials. The managed test runner passes only an allowlisted environment,
sets NODE_ENV=test, and disables Wrangler dotenv loading. Direct HTTP tests
reject non-loopback targets. Tests use dynamic ports and independent stores;
Playwright serializes mutations within a run. CI hides the control.

Manual startup resolves explicit mode, valid `surety:environment-mode`, then
Demo. An automated launch always wins. A tab stores its current session in
sessionStorage; a different tab never hot-switches because localStorage changed.
Cancelling a settings draft confirmation leaves mode, preference and instance
unchanged. Accepted switching reloads the home route. Unavailable browser
storage is tolerated; preferences then cannot survive an independent reload. Accepted switching passes a
short-lived instance ID in the navigation URL so it still reloads into the chosen
instance without storage; initialization removes that parameter. It cannot enable
local capability or override automated locking.

Storage cleanup revalidates app/root/path markers, canonical paths and UID.
An exclusive lock rejects concurrent ownership of persistent Demo. Reset refuses
active Demo, foreign paths and wrong markers. Partial catalog seeding leaves
Demo intact and fails visibly; inspect it before an explicit reset. SIGKILL or
machine power loss can leave owned storage/locks: inspect process ownership
before manually recovering; automatic sweeping deliberately does not delete it.
Existing `.wrangler` directories and user configuration are preserved.

## Production parity and migration history

`wrangler.toml` and generated local config share the real entrypoint,
compatibility date/flags, bun:sqlite alias, SPA asset behavior and D1/R2 binding
names. Local database/bucket identifiers, storage, fixture JWKS, provider origin
and environment mode intentionally differ. No production routes, credentials or
remote bindings are copied. No rate-limit binding is currently configured.

`apps/worker/migrations/` is the migration source for local and Production
Wrangler configurations. `0001_initial.sql` is the existing schema baseline;
verification checks its parity with the SQLite unit-test DDL. Future schema
changes require versioned SQL migrations and corresponding Drizzle schema/tests.
The old `db:push` shortcut was replaced by explicit `bun run db:migrate`, which
applies the same migration directory remotely. This command is administration,
not startup/test setup. It was **not executed**. Before the first authorized
remote application, inspect the deployed schema and migration history and back
up that instance; no remote schema parity is claimed by local tests.

## Catalog and feature coverage

All records are synthetic. Four related family members, two assets, two insurers,
seven insurance categories, ten policies and two visits exercise the normal
application. Dates and premiums are coherent with the anchor. Stable insertion
order produces repeatable numeric IDs in a fresh store. Existing Demo catalogs
are never silently overwritten. The original SVG generator creates PNG/PDF
attachments; the real upload route validates and stores them in native R2.
No production dump, personal ID number or real contact information is used.

Only external provider boundaries are deterministic: synthetic author metadata
and Backy success/history/failure responses. Unknown provider requests fail
closed. Worker request construction, parsing, backup serialization and errors
remain real. Beneficiaries and cash values have no write API, so their seed uses
owned local D1 SQL; application reads still use the production repositories.

| Feature / route              | Prepared fixture or scenario                                        | Executed evidence                                                    | Visual review                                                    |
| ---------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Dashboard `/`                | Six active policies, income, premiums, family distributions         | API aggregates; browser dashboard tests                              | Desktop and mobile reviewed                                      |
| Members `/members`           | Self/spouse/child/parent, gender, DOB, social insurance             | Browser CRUD and count assertions                                    | Route captured                                                   |
| Assets `/assets`             | Synthetic apartment and car, ownership                              | Browser CRUD                                                         | Route captured                                                   |
| Insurers `/insurers`         | Two insurers, reserved example URLs/fictional phone                 | Browser CRUD; real catalog creation                                  | List reviewed                                                    |
| Policies `/policies`         | Seven categories; active, expired, surrendered, lapsed, claimed     | Browser CRUD, filters/status workflows                               | Route captured                                                   |
| Policy detail `/policies/1`  | Medical coverage, deductible, paid/pending premiums, timeline       | Browser transitions/payment checks                                   | Detail reviewed                                                  |
| Life/annuity details         | Beneficiary, cash values, planned surrender                         | Seed SQL/read APIs; transition tests                                 | Not separately reviewed                                          |
| Attachments                  | Original 960×600 PNG and PDF                                        | Real uploads/downloads; image naturalWidth assertion                 | Preview reviewed                                                 |
| Coverage `/coverage-lookup`  | Related member and asset policies                                   | Existing browser queries                                             | Route captured                                                   |
| Renewals `/renewal-calendar` | Overdue/current/upcoming dates, yearly schedules                    | Existing browser calendar checks                                     | Route captured                                                   |
| Hospitals `/hospitals`       | Public tertiary hospital and private clinic                         | Browser CRUD                                                         | Route captured                                                   |
| Doctors `/doctors`           | Named synthetic physician, department/title                         | Browser CRUD                                                         | Route captured                                                   |
| Visits `/medical-visits`     | Outpatient and emergency, colored symptom tags, diagnoses and costs | Browser CRUD                                                         | List and symptom tags reviewed                                   |
| Settings `/settings`         | Income/currency/reminder, dirty-edit scenario                       | Save/reload plus cancelled/accepted mode switch                      | Settings reviewed                                                |
| Backup/export                | Synthetic household JSON, Backy history, success and 503            | HTTP export; real provider-boundary push 200/502                     | History reviewed                                                 |
| Restore                      | Existing JSON importer                                              | Existing validation tests only                                       | Native D1 restore remains unsupported; do not claim full restore |
| CLI `/cli`                   | Real command help; real signed token issuance                       | Native CLI members list; token revoke and cross-run rejection        | Help route captured                                              |
| Auth/account                 | Synthetic avatar; session vs bearer permissions                     | Missing/forged JWT, issuance, revoke, bearer permission denial       | Avatar reviewed                                                  |
| Environment chrome           | Default/explicit/saved modes, two tabs, stale requests              | Native gateway + Chromium verification; server lock/CI/hosted checks | Desktop/mobile reviewed                                          |
| Search/empty/errors          | Focused existing browser scenarios; empty E2E dataset               | Existing filters/CRUD validation; failed provider scenario           | Not every error state reviewed                                   |

There are no app roles beyond interactive-session and bearer permissions, no
comments subsystem, no bulk-action feature and no reminder delivery job.
Category/status labels and chart colors are provided by the real UI.

## Evidence and remaining limits

Executed: build, strict lint/types, coverage, real HTTP and browser suites,
isolation/switching verification, route-level unit tests and CLI tests. Exact
run counts and evidence paths are recorded in the workflow Surety record.
Captured does not mean visually reviewed; the matrix distinguishes them.

Production was not accessed or changed. Real Access login/MFA, external provider
availability, remote migration history and deployment behavior remain unverified.
Local fixture JWTs do not certify those boundaries. Full all-source 6DQ coverage
and every endpoint/error permutation remain the pre-existing contract gaps in
AGENTS.md. Native D1 restore remains a known product limitation.

The obsolete sqlite-proxy client, remote seed and duplicate startup paths were
removed after native replacement passed. The SQLite route harness under
`__tests__/e2e` remains useful **unit-level** evidence only; its historical directory
name does not make it native E2E. No running product uses its fake R2/context.
