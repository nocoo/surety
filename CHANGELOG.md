# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Quality system 第二轮升级 (2026-04-22)** — see [docs/17-quality-to-S.md](docs/17-quality-to-S.md):
  - L1 coverage thresholds raised from 90/85 to **95/95** (line/function)
  - **L2 HTTP suite** (`apps/worker/__tests__/l2-http/`) — wrangler dev `--local` on port 7017 + real D1/R2 bindings; 3 specs covering live, members/policies CRUD, and R2 attachment round-trips. Wired into pre-push gate.
  - **L3 Playwright suite** (`apps/web/tests/playwright/`) — chromium-only on port 27012; 10 specs covering auth contract, navigation, dashboard, members, policies, coverage-lookup, and SPA fallback. On-demand via `bun run test:e2e:browser`.
  - Existing 23 Hono-test-client tests retained as **L2-integration** alongside the new L2-HTTP layer.

### Changed

- **Architecture rewrite** — replaced Next.js 16 (Railway) + Worker D1-proxy with a single Cloudflare Worker stack: Vite + React 19 + React Router 7 SPA served by a Hono Worker (`apps/worker`) talking directly to D1 via binding. Old Next.js app moved to `apps/web_legacy/` for transition reference.
- **MCP → CLI migration complete** — `packages/mcp` removed; `@nocoo/surety` CLI (`apps/cli`) is the sole AI/script surface, authenticating with Bearer tokens against `surety-api.hexly.ai`.
- **Quality system upgraded to S** — six-tier pyramid (L1/L2/L3/G1/G2/Worker). L2 rebuilt as Hono test client + in-memory D1 (`apps/worker/__tests__/e2e/`, 23 tests). gitleaks moved to pre-commit. ESLint strict + `*.skip`/`*.only` ban. See [docs/17-quality-to-S.md](docs/17-quality-to-S.md).

### Removed

- `packages/mcp/` (all MCP server code, tools, and tests)
- `apps/web_legacy/src/app/settings/components/mcp-settings.tsx` (settings page MCP toggle)
- `@modelcontextprotocol/sdk` and pinned hono@4.11 transitive ignores from `osv-scanner.toml`
- `packages/mcp/src/**` from `bunfig.toml` `coverageInclude`
- `apps/web_legacy/` — the entire transitional Next.js app, including its tests, drizzle config (hoisted to repo root), and build scripts (hoisted to `scripts/`)
- Root `@/*` tsconfig path alias (only consumed by web_legacy; `apps/web` defines its own)
- `next`, `next-auth`, `eslint-config-next`, `@playwright/test` dependencies
- L3 Playwright UI E2E suite (`apps/web_legacy/e2e/`) and the `*.e2e.test.ts` API harness that targeted the Next.js Worker proxy
- `test:e2e`, `test:e2e:ui`, `test:all`, `dev:legacy`, `build:legacy`, `test:legacy` npm scripts

## [v1.6.0] - 2026-04-21

### Changed

- **Monorepo restructure** — reorganized from single Next.js app to Bun workspace monorepo: `apps/web`, `packages/db`, `packages/api`, `packages/mcp`
- Framework-agnostic business logic extracted to `@surety/api`, DB layer to `@surety/db`
- ESLint config moved to repo root to cover all packages
- CI upgraded to base-ci v2026.1

### Fixed

- Test coverage script aligned with test command globs
- Version test reads root package.json to match APP_VERSION source
- Dockerfile, L1 cache, E2E distDir, and package tsconfig monorepo integration issues

## [v1.5.9] - 2026-04-14

### Added

- **Medical visits module** — full CRUD for hospitals, doctors, and medical visit records with API routes, repositories, DB schema, MCP tools, and E2E tests
- **Medical visits UI** — list page with filters, visit sheet (create/edit form), symptom tag input, cost validation, age-in-months display, and days-ago calculation
- **Colored avatars** — hash-based avatar colors for members (medical visits table), doctors, and hospitals; hospital avatars skip common city prefixes for distinctive initials
- **Visit type badge colors** — each visit type gets a semantic color: 门诊=primary, 急诊=destructive, 体检=teal, 复查=info, 预约=purple, 儿保=success
- **MCP medical tools** — CRUD tools for hospitals, doctors, and medical visits with full validation
- **CSV import** — medical visits CSV import script for data migration
- **GitHub Actions CI** — added CI workflow for automated testing

### Fixed

- **Orphan insurer leak** — policy PUT route now rolls back newly-created insurers when the policy is concurrently deleted (race condition between pre-check and update)
- **Insurer referential integrity** — validate applicant before findOrCreate insurer in POST, check policy exists before creating insurer in PUT
- **Constraint match narrowed** — only catch UNIQUE + policy_number violations, not all constraint errors
- **Backup integrity** — backfill all post-v1-baseline keys, narrow backfill scope to prevent partial backup wiping data, restore full-replace semantics with backward-compat
- **Future date display** — `formatDaysAgo` now shows "X天后/周后/月后/年后" instead of negative numbers
- **Table divider colors** — content row dividers use `border-border/50` per B-4 Basalt spec
- **Table column truncation** — important columns (hospital names, addresses, diagnoses) no longer truncate with ellipsis
- **Delete dialogs** — add try/catch and show backend error messages
- **D1 transaction wrapper** — skip transaction wrapper for D1 sqlite-proxy in seedDatabase
- **Lightweight delete** — revert to `returning().all()` pattern for D1 compatibility
- **findOrCreate concurrency** — make concurrent-safe and move into try/catch
- **TOTP decrypt** — wrap `decryptSecret()` calls in try/catch
- **Coverage section** — fix sortOrder calculation and add error handling
- **Donut chart** — add empty data state handling
- **Payments section** — preserve Overdue status and add error handling
- **Policy meta column** — handle Expired status and disable Asset option
- **Hydration flash** — fix useSyncExternalStore in useMobile hook
- **MCP timezone** — avoid UTC timezone shift in renewal-overview date parsing
- **Renewal calendar** — unify window boundary inclusive/exclusive rules
- **Sidebar mobile** — drawer ignores collapsed state
- **Symptoms format** — JSON array format used consistently
- **Chinese error messages** — consistent in medical visits API

### Changed

- **Assessment column removed** — dropped unused assessment field from DB schema, API routes, form, table, MCP tools, and all tests
- **Settings decomposed** — refactored 1262-line page into sub-components
- **MCP deduplication** — extracted shared utilities to `mcp/tools/shared.ts`
- **Dashboard performance** — memoize inline data transforms
- **DB performance** — add indexes on foreign key columns, optimize delete operations
- **Race condition test** — rewrote to call real PUT handler via `mock.module` injection (not fake re-implementation)
- **CI migration** — migrate to `base-ci@v2026`, disable L2 E2E
- **Dependencies** — update hono, next, drizzle-orm to fix CVEs

## [v1.5.8] - 2026-04-04

### Changed

- **Per-page skeleton loading** — replaced generic spinner with layout-matched skeletons for insurers, assets, renewal calendar, coverage lookup, and policy detail pages (B-4 compliance)

## [v1.5.7] - 2026-04-04

### Security

- **callbackUrl validation** — login page now validates callbackUrl parameter to prevent open redirect attacks

### Changed

- **Navigation data extraction** — moved NAV_GROUPS to `@/lib/navigation.ts` (B-2 compliance)
- **SiteFooter component** — extracted reusable footer component from login page (B-1 compliance)
- **Dev port migration** — dev server port changed from 7015 to 7012

## [v1.5.1] - 2026-03-27

### Added

- **Multi-file upload** — drag-and-drop supports multiple files in one operation; JPG/PNG images alongside PDF with per-format magic bytes validation
- **Image preview** — attachment preview dialog renders images via `<img>` (PDF still uses `<iframe>`)
- **Attachment picker** — when a policy has 2+ attachments, clicking preview opens a selection dialog before viewing
- **Policy number editing** — BasicInfoSection now includes inline edit for policy number (保单号)
- **Full payment editing** — payment records support full edit (period, due date, amount, status, paid date) via expanded PaymentForm, replacing inline amount-only edit
- **Notes column in policy list** — 备注 column between 下次缴费 and 附件, responsive (hidden below xl breakpoint)
- **Section header icons** — Banknote icon + count badge on payments section, Clock icon on timeline section
- **Applicant avatar** — policy list table shows avatar for applicant matching insured column style

### Fixed

- **Timezone date bugs** — replaced all `new Date("YYYY-MM-DD")` (UTC parse) and `.toISOString().split("T")[0]` (UTC format) with canonical `parseLocalDate()` / `formatLocalDate()` pair across 9 bug sites
- **insuredType mutual exclusion** — three-layer fix: frontend conditional UI, client-side field clearing, server-side normalization in API PUT
- **Applicant null crash** — split member options so applicant selector (NOT NULL) no longer includes "未知/空白" option
- **Empty fields unreachable** — all policy detail fields now always visible with "—" placeholder; removed conditional hiding of payment details, date info, and notes sections

### Changed

- **Meta column header icon** — Pencil → ShieldCheck to match policy context
- **Payment card layout** — unified multi-line card style matching coverage section pattern (header row with status badge + hover action buttons, detail rows below)
- **Column order** — policy list table and filters now show 投保人 before 被保人

## [v1.5.0] - 2026-03-26

### Added

- **Policy detail page** — dedicated `/policies/[id]` page with 4-column responsive layout (Meta, Timeline, Coverage, Payments)
  - **MetaColumn**: basic info, people, beneficiaries, attachments, payment details (years, total periods, renewal type, account)
  - **TimelineColumn**: visual timeline with policy dates (effective, hesitation, waiting period, next due, renewal, expiry) with "today" marker
  - **CoverageSection**: full CRUD for coverage items with inline add/edit/delete
  - **PaymentsSection**: payment list, manual add, mark-paid, delete, auto-generate with confirmation
- **Payment CRUD API** — POST create, PUT update, DELETE delete for payment records with 409 conflict on duplicate period numbers
- **PolicyEditDialog** — Dialog-based edit form integrated into detail page header, replaced PolicySheet
- **Unique constraint** — (policy_id, period_number) on payments table to prevent duplicate periods

### Fixed

- **Payment date overflow** — month-end and leap-day edge cases now clamp to target month end
  - Jan 31 + 1 month → Feb 28/29 (not Mar 3)
  - Feb 29 + 1 year → Feb 28 in non-leap years (not Mar 1)
- **Payment generation bug** — fixed `totalPayments=null` only generating 1 record; now generates up to cutoff date (1200 cap)
- **createMany batching** — split into batches of 10 to work around D1 bound parameter limit (~100)

### Changed

- **Entry points migration** — all "view detail" links now navigate to `/policies/[id]` instead of dialog
  - Coverage lookup cards
  - Renewal calendar product names
  - Policies list table/cards
- **Removed** — PolicyDetailDialog (946 lines) and PaymentsDialog (265 lines) replaced by detail page
- **Removed** — "添加保单" button from policies list page (create flow to be reimplemented separately)

## [v1.4.0] - 2026-03-26

### Added

- **Policy PDF attachment** — drag-drop upload, in-browser PDF preview, and download for policy documents stored in Cloudflare R2 private buckets
- Cloudflare R2 bucket bindings (prod/test) and Worker route handlers (PUT/GET/DELETE /r2/:key) with end-to-end streaming
- Attachments DB schema with policy_id index, repository (factory pattern), and cascade delete support
- Attachment validation: file type, size (50MB limit), PDF magic bytes (`%PDF-`), and per-policy count soft limit (20)
- R2 client with Bearer auth, X-Target-DB header routing, RFC 5987 UTF-8 filename encoding, and `duplex: "half"` for streaming uploads
- XHR upload-with-progress helper for large file uploads (fetch API lacks upload progress events)
- AttachmentSection UI: AttachmentDropZone (react-dropzone), AttachmentList, AttachmentPreviewDialog (iframe PDF viewer)

### Fixed

- File download Cache-Control changed from `max-age=3600` to `no-store` — URL is attachment-ID-based, not content-addressed; prevents deleted files from being served from browser cache
- R2 cleanup in delete paths moved before DB delete to prevent env-missing errors from turning successful DB deletes into 500
- Frontend delete now checks HTTP response status and shows error message instead of silently closing the dialog

### Changed

- Policy cascade delete now includes attachments table and best-effort R2 object cleanup
- Legacy `policyFilePath` link relabeled as "旧" for Phase 1 coexistence with new attachment system
- Worker CORS expanded to include PUT and DELETE methods

## [v1.3.3] - 2026-03-24

### Added

- **MCP CRUD tools** — full create/update/delete support for all 8 entities: member, policy, beneficiary, insurer, asset, payment, cash value, and coverage item
- Editable project path input in MCP config display

### Fixed

- Cascade delete for policy children and FK restrict checks
- Nullable fields for identity/status migration paths
- Validation for beneficiary identity and payment status
- Worker tsconfig strict extras (5 additional TS strict options)

### Documentation

- MCP CRUD tools expansion design doc
- Updated MCP docs for CRUD tools

## [v1.3.2] - 2026-03-23

### Added

- **G1 ESLint strict upgrade** — enable `tseslint.configs.strict` overlay with `no-non-null-assertion`, `no-dynamic-delete`, and `--max-warnings=0` zero-tolerance policy
- **G2 security gate** — `osv-scanner` (dependency CVE scan) + `gitleaks` (secret detection) as pre-push hooks
- **lint-staged** — incremental ESLint on staged files only (replaces full-repo lint in pre-commit)
- `osv-scanner.toml` configuration with 16 transitive CVE ignores (reviewed, expiry 2026-06-23)
- `.gitleaks.toml` allowlist for test fixture false positives (test API keys in unit/E2E tests)

### Changed

- **D1 test database renamed** — `surety-db-dev` / `DB_DEV` → `surety-db-test` / `DB_TEST` across Worker bindings, client types, E2E runners, seed scripts, and API routes
- `TargetDb` type narrowed from `"production" | "dev"` to `"production" | "test"` for semantic clarity
- Pre-commit hook: `bun run lint` → `bunx lint-staged` (faster, scoped to staged files)
- Pre-push hook: added `osv-scanner --lockfile=bun.lock && gitleaks protect --staged --no-banner` before E2E
- Upgraded `next` and `eslint-config-next` from 16.1.6 to 16.1.7

### Fixed

- 132 ESLint strict violations (129 `no-non-null-assertion` + 3 `no-dynamic-delete`) resolved with type-safe casts and null guards
- 53 TypeScript `TS2532`/`TS18048` errors from stricter null-safety after removing `!` assertions
- Database switch E2E test still referenced obsolete `"dev"` target

### Removed

- Obsolete `restore-prod.ts` script (dead code, zero references)

### Documentation

- Quality system upgrade plan (`docs/` numbered documents)
- Updated CLAUDE.md D1 references, test framework description, and E2E isolation constraints

## [v1.3.1] - 2026-03-15

### Removed

- Unused `ui/card.tsx` shadcn component (zero imports)
- Completed one-time migration scripts (`migrate-beneficiaries.ts`, `migrate-insurers.ts`)
- `@radix-ui/react-collapsible` dependency (migrated to `radix-ui` unified package)
- Dead exports from `palette.ts`, `chart-config.ts`, `charts/index.ts`, `db/types.ts`
- Unused `_resetTotpService()` function from TOTP adapter
- `palette.ts` merged into `chart-config.ts` (single consumer, 7 dead exports)

### Fixed

- 3 test files (`backup`, `policy-status`, `sidebar-nav`) were not included in pre-commit CI coverage — now added (50 tests)
- README project tree still listed deleted migration scripts

### Documentation

- TOTP implementation details document (Chinese)

## [v1.3.0] - 2026-03-09

### Added

- **Two-factor authentication (TOTP 2FA)** — full implementation including setup, login verification, recovery code, trusted device, and force-disable flows
- TOTP core utilities (encrypt/decrypt secret, QR code generation, brute-force protection, nonce-based session promotion)
- 2FA guard in proxy with trusted-device cookie bypass
- 2FA verification page with 6-digit input, recovery code mode, and "trust this device" toggle
- 2FA settings card (setup, disable, force-disable for recovery sessions)
- Remember device toggle on 2FA verification page
- Independent TOTP module (`src/lib/totp/`) with zero host-app coupling, `TotpStore` interface, and 100% test coverage
- Proxy decision logic extracted to `src/lib/proxy-logic.ts` with 44 regression tests
- TOTP module documentation (`docs/09-totp-module.md`)

### Fixed

- **Security**: Prevent 2FA bypass via `updateSession()` — require server-signed nonce for JWT promotion
- **Security**: Filter `totp.*` sensitive keys from generic Settings API endpoints
- **Security**: Add brute-force protection to verify-setup and disable endpoints
- **Security**: Enforce auth and 2FA checks on all API routes via proxy
- **Security**: Block trusted-device cookie issuance on recovery code login (break-glass credential)
- **Security**: Remove unconditional trusted-device cookie from verify-setup route (require explicit user consent)
- **Security**: Scope `forceDisable` authorization to session via JWT `recoverySession` claim instead of global DB flag
- **Security**: Revoke `recoverySession` JWT claim after force-disable and on re-setup (prevent sticky one-time privilege)
- Replace `Bun.password` with `node:crypto` scrypt for Next.js server runtime compatibility
- Ensure `verifySetup` computes all derived values before writing state (atomic operation)
- Resolve 2FA deadlock when JWT is stale after disabling 2FA (proxy checks DB truth)
- Exempt current session from 2FA after initial setup via nonce-based JWT promotion
- Redirect trusted-device users away from `/verify-2fa`
- Left-align QR code and show environment tag in TOTP issuer

### Changed

- Refactored TOTP from single file into independent reusable module with adapter pattern

### Documentation

- 2FA security review findings and retrospective learnings (3-agent review, 2FA spec)
- TOTP module architecture documentation
- Retrospective entries for Bun.password, atomicity, JWT desync, session-scoped auth, sticky JWT claims

## [v1.2.2] - 2026-03-09

### Added

- Collapsible navigation groups in sidebar (总览 / 数据管理 / 系统) with smooth CSS Grid animation
- Radix Collapsible UI primitive (`@radix-ui/react-collapsible`)
- Unit tests for sidebar navigation group data structure and type contracts

### Fixed

- Align logo assets with single-source convention

## [v1.2.1] - 2026-03-07

### Fixed

- Restore the dashboard client boundary so server-rendered data no longer passes functions into client chart components at runtime

## [v1.2.0] - 2026-03-07

### Fixed

- Persist financial settings instead of showing a false saved state
- Replace the mobile sidebar overlay with an accessible sheet and move policy dialog side effects into `useEffect`
- Improve policy mobile layouts, sorting semantics, coverage lookup accessibility, crowded donut chart fallback, and database switching feedback
- Add user-visible error messages for failed actions, explain disabled delete buttons, and complete breadcrumb semantics

### Changed

- Render the dashboard on the server for a faster first paint and lower client-side loading cost
- Normalize semantic color usage across shared config and asset presentation

## [v1.1.0] - 2026-03-06

### Changed

- Upgrade all dependencies to latest compatible versions (13 packages updated)
- Remove unused `date-fns` dependency

### Improved

- Deduplicate `formatCurrency` to single source in `chart-config.ts`
- Consolidate and clean up redundant unit tests (health, coverage-lookup-vm, chart-config, category-config, version, backy-service)
- Move BDD E2E from pre-push hook to on-demand execution for faster push cycles

### Documentation

- Sync README project tree with current codebase structure
- Sync database design docs with current schema (9 tables)
- Fix pre-push hook description to match actual behavior

## [v1.0.2] - 2026-03-03

### Added

- ESLint strict mode: `no-explicit-any`, `no-unused-vars`, `no-console` (src/mcp only) enforced as errors
- E2E tests for `GET /api/live` (health-check smoke test) and `POST /api/backup` (restore round-trip)
- Port pre-check utility (`scripts/e2e-utils.ts`): detects and kills stale processes before starting E2E servers
- Server failure log dump: E2E runners now output captured stdout/stderr when the dev server fails to start

### Fixed

- Husky hooks realigned with four-layer testing spec: coverage check moved to pre-commit, pre-push now only runs E2E
- `run-e2e.ts` now cleans WAL/SHM/journal files (aligned with `run-e2e-ui.ts`)

### Documentation

- Four-layer testing improvement plan (`docs/06-testing-improvement-plan.md`)

## [v1.0.1] - 2026-02-23

### Changed

- Replace logo with transparent-background version; simplify to single `<img>` (no more dark/light variants)
- Show user email instead of static "家庭管理员" label in sidebar
- MCP server version now reads from `APP_VERSION` (no more hardcoded string)

### Removed

- Unused Next.js starter SVGs (file, globe, next, vercel, window)

## [v1.0.0] - 2026-02-23

First stable release. A fully functional family insurance policy management tool
with local-first architecture, privacy-safe design, and comprehensive test coverage.

### Features

- **Dashboard** — rich visualizations with chart cards, member-category stacked bars, timeline charts, and 5-row thematic layout
- **Policy Management** — full CRUD with filters, sortable headers, category/insured/list view modes, detail dialog, and localStorage-persisted preferences
- **Coverage Items** — inline CRUD for per-policy coverage items with display in detail dialog
- **Coverage Lookup** — member selector with policy cards, asset support, and inactive policy filter toggle
- **Renewal Calendar** — 12-month consecutive view with policy-based stacking and member avatar badges
- **Family Members** — CRUD with ID type/expiry, social insurance flag, colorful avatar, and pet support
- **Assets** — CRUD with delete protection and policy count display
- **Insurers** — management page with verified phone numbers and websites
- **Payments** — dialog component for viewing payment history with next due date countdown
- **Settings** — preferences, JSON backup export/import, MCP access toggle, and Backy remote backup
- **Multi-database** — selector dropdown with cookie-based switching
- **Google OAuth** — login with email allowlist, secure cookie support for HTTPS reverse proxy
- **MCP Server** — AI assistant integration (Claude Code, Cursor) with security guard and stdio transport
- **Backy Integration** — remote backup service with push, history, and webhook configuration
- **Health Check** — `/api/live` endpoint with database probe, runtime info, and version reporting
- **Version Display** — sidebar badge showing current version, centralized via `lib/version.ts`
- **Dark Mode** — 3-state theme toggle (system/light/dark) with FOUC prevention
- **Mobile Support** — sidebar overlay with hamburger menu and body scroll lock
- **Basalt Design System** — floating island layout, HSL design tokens, Inter + DM Sans fonts, 24-color chart palette

### Testing

- **350+ unit tests** with 90%+ coverage across repositories, view models, utilities, and MCP tools
- **API E2E tests** — comprehensive BDD-style tests for all API routes (port 7016)
- **Playwright E2E** — 58 browser tests across 9 specs covering navigation, CRUD, and settings (port 7017)
- **MCP E2E tests** — subprocess-based integration tests for MCP server
- **Pre-commit** (UT + coverage + Lint) and **pre-push** (API E2E + UI E2E) hooks via Husky

### Infrastructure

- Next.js 16 App Router with TypeScript strict mode
- SQLite + Drizzle ORM with Bun runtime
- Railway deployment support with Docker and SQLite volume mount
- Database protection guards preventing accidental production data loss
- CSV import script for real policy data migration

## v2.1.2

### Changed
- Generate handles concurrent requests via onConflictDoNothing
- Freeze clock and assert generate never emits future dues
- Payments generate is pending-only, backfills past, idempotent
- Cover generatePaymentRecords behavior and edge cases
- Generate-payments take options bag with markPastAsPaid
- Bump react-router 7.18.0 → 8.0.0
- Bump @cloudflare/workers-types to 4.20260617.1
- Upgrade wrangler 4.99.0 → 4.101.0
- Upgrade react-router 7.17.0 → 7.18.0
- Upgrade lucide-react 1.18.0 → 1.20.0
- Upgrade @cloudflare/workers-types 4.20260615.1 → 4.20260616.1
- Batch upgrade 7 dependencies (incl. vite security fix) (#117)
- Tighten /api/auth/cli Sec-Fetch-Site allowlist to {none, same-origin}
- Reject cross-site navigations on /api/auth/cli
- Require Sec-Fetch top-level navigation for /api/auth/cli
- Add Origin/Referer CSRF guard for session-authenticated writes
- Bump @cloudflare/workers-types 4.20260612.1 → 4.20260613.1
- Upgrade base-ci to v2026.4
- Bump @tailwindcss/vite 4.3.0 → 4.3.1
- Bump @tailwindcss/postcss 4.3.0 → 4.3.1
- Bump tailwindcss 4.3.0 → 4.3.1
- Bump lucide-react 1.17.0 → 1.18.0
- Bump eslint 10.4.1 → 10.5.0
- Bump @cloudflare/workers-types 4.20260610.1 → 4.20260612.1
- Bump @types/node 25.9.2 → 25.9.3

### Fixed
- Generate cutoff uses CST calendar date, not UTC clock
- Payments createMany skips policy/period conflict for concurrency
- Clarify payments generate dialog wording
- Generate payments only up to today, never auto-paid
- Override esbuild to ^0.28.1 (GHSA-gv7w-rqvm-qjhr)
- Align loading skeletons with current page layouts

## v2.1.1

### Added
- Add WholeLife (终身寿) policy category

### Changed
- MAJOR @types/node 22.19.20 → 25.9.2
- MAJOR eslint 9.39.4 → 10.4.1
- MAJOR vite 6→8 + @vitejs/plugin-react 4→6
- Batch minor/patch upgrades + eslint ignore .wrangler/coverage
- Policy detail page → 1:1:1 three-column layout

### Fixed
- Align Playwright e2e with current dashboard / coverage UI

## v2.1.0

### Added
- Renewal calendar dialog as URL state + round-trip back nav
- Coverage health ratio excludes savings-type premium
- SectionDivider for page-level segments; default everything open
- Renewal calendar legibility + multi-event dialog
- Stat cards get derived sub-lines
- Settings page tracks dirty state
- Dashboard rehome — health + actions, charts demoted
- Global Cmd+K command palette
- Brand-toned dashboard greeting + warmer empty states
- Coverage-lookup emergency UI
- Renewal calendar — 12-month calendar grid view
- Medical visit timeline view
- Policy list density toggle (cards / comfortable / compact)
- Add semantic *-text tokens for accessible inline copy
- Add Notice component for inline status messages

### Changed
- Suppress recharts default focus outline
- Rename "寿险" → "定期寿" display label
- Unify category type display to Badge + getCategoryConfig
- Mark audit 18 long-tail debt as done
- Policies row visual decluttering
- Split CLI into its own collapsed "开发者" group
- Mark audit 18 week-3/4 roadmap items as done
- Mark audit 18 week-2 roadmap items as done
- Trim medical visit table from 12 to 7 columns
- Consolidate policy filters into chip + sheet UI
- Policy detail to 7/5 split layout
- Revise audit 18 week-1 status — withdraw #17, expand #9
- Mark audit 18 week-1 roadmap items as done
- Symptom tags use hash-keyed chart palette
- Map remaining hardcoded colors to semantic tokens
- Map renewal/policy-detail amber+emerald to warning+success
- Replace hardcoded icon container colors with semantic tokens
- Align avatar palette with chart palette
- Consolidate table-row hover to TableRow default
- Use AlertDialogAction variant=destructive everywhere
- Offset chart-1 hue from primary vermilion
- Declare explicit CJK font stack
- Add baoyu design audit report (18)

### Fixed
- Dashboard tolerates stats without protectionPremium
- Visit-sheet symptom tag-input visual height
- Coverage-lookup avatars use verified-contrast palette
- Sidebar group containing the current route opens on mount
- Policy status accessible to keyboard/touch/screen readers
- Settings dirty guard catches in-app navigation too
- Coverage-lookup keeps asset tab when no asset is selected
- Dashboard action card labels match natural-month buckets
- Coverage-lookup honors ?member= / ?asset= deep links
- Days-ago and age-in-months handle invalid dates
- Visit date formatter handles invalid input gracefully
- Timeline shows unknown-date bucket instead of dropping rows
- Hide density toggle on mobile (state matches view)
- Medical-visits header wraps on mobile
- Use text-warning-text for icons that fail 3:1 graphical AA
- Introduce avatar-only palette with verified contrast
- Revert avatar palette to readable tokens (a11y)

### Removed
- Drop uppercase + tracking-wider from CJK section labels

## v2.0.6

### Changed
- Bump @types/node from 20 to 22.19.20
- Upgrade lucide-react to 1.17.0
- Extract Github icon from lucide-react 0.577
- Bump lint-staged to 17.0.7
- Bump radix-ui to 1.5.0
- Bump @types/node to 20.19.42

## v2.0.5

### Changed
- Untrack .claude/scheduled_tasks.lock
- Upgrade TypeScript to 6.0.3
- Stop tracking autoresearch.jsonl benchmark log
- Bump ws to 8.21.0
- Bump typescript-eslint to 8.60.1
- Bump vitest and @vitest/coverage-v8 to 4.1.8
- Bump react/react-dom to 19.2.7, @types/react to 19.2.17
- Bump hono to 4.12.23

### Fixed
- Persist status filter with reset key

### Removed
- Drop csv-parse from manifest
- Remove one-off medical-visits import script and csv-parse
- Remove unused @hono/node-server, otpauth, qrcode, zod

## v2.0.4

### Added
- Show months for children under 5 years old

### Changed
- Add packageManager bun to wrangler-action
- Install chromium-headless-shell for Playwright tests
- Add --ignore-scripts to custom workflows (Shai-Hulud defense)
- Enable L2 gate in CI

### Fixed
- Widen edit mode input fields to w-64
- Do not fallback to effectiveDate for nextDueDate
- Default to showing all policies instead of persisting filter
- Upgrade wrangler-action v3 to v4
- Bump ws to 8.20.1 (GHSA-58qx-3vcg-4xpx)
- Run playwright install from apps/web to match local version
- Upgrade hono to fix CVE

## v2.0.3

### Changed
- Correct L1 test command — vitest run, not bun test
- Exclude playwright from bun test pathIgnorePatterns
- Add release.yml for CF Worker CD

### Removed
- Remove cloud -test resources, use top-level bindings + --local

## v2.0.2

### Changed
- CLI page install/auth/token sections
- Coverage-lookup member/asset switching + data display
- Dashboard stat cards + all chart sections
- Policies page full CRUD + detail navigation
- Comprehensive coverage exclude for L1-only scope
- Scope cli coverage include to src
- Fix 3 vitest-migrated test files
- Migrate user.test.ts from bun:test to vitest
- Migrate api.test.ts from bun:test to vitest
- Migrate readonly.test.ts from bun:test to vitest
- Migrate policies.test.ts from bun:test to vitest
- Migrate policies-coverage.test.ts from bun:test to vitest
- Migrate output.test.ts from bun:test to vitest
- Migrate json-input.test.ts from bun:test to vitest
- Migrate crud.test.ts from bun:test to vitest
- Migrate config.test.ts from bun:test to vitest
- Migrate client.test.ts from bun:test to vitest
- Migrate unit tests from bun:test to vitest
- Add vitest config with coverage thresholds
- Add vitest and @vitest/coverage-v8
- Unify HTML title to "surety - 家庭保单管理工具"
- 54ms steady floor + segment 7 ideas.md update
- Cli split with cross-shard coverage merge: 59→54ms (-8%)
- Floor confirmation + ideas.md update: 59ms steady (best of 20)
- Mock fs.readFileSync in json-input tests (skip /tmp I/O): 66→64ms (-3%)
- Move secure-headers wiring assertion L1→L2: 115→66ms (-43%), worker cold-import gone
- Inline check-coverage.ts into run-l1.ts (skip wrapper layer): 127→115 (-9%), hit 40→20 (-50%)
- Speculative spawn + skip git rev-parse: 204→151ms (-26%, vs baseline 257→151 -41%)
- L1 cache-miss: delegate to check-coverage.ts (parallel + gate). 257→204ms (-21%)
- Add bench-pre-commit.ts + autoresearch baseline

### Fixed
- Migrate pre-push worker+cli step to vitest
- Migrate run-l1.ts from bun test to vitest

### Removed
- Remove packages from coverage include
- Drop mkdtemp from buildClient tests (HOME ignored anyway): 64→59ms (-8%)
- Drop setTimeout(10) in middleware test, use deferred: 151→127ms (-16%)

## v2.0.1

### Added
- Add /cli page with token management
- Add secure response headers middleware
- Add L3 specs for members/policies/coverage/404
- Add L3 specs for auth contract + core navigation
- Scaffold Playwright config for L3 browser regression
- Cover R2 attachments via wrangler local R2 emulator
- Add L2 HTTP CRUD tests for members + policies
- Scaffold wrangler-based L2 HTTP runner + smoke test
- Raise L1 coverage thresholds to 95/95

### Changed
- Log run#65 floor confirmation
- Resume #2 floor confirmation + ideas.md updates: 62ms within-noise
- Bun --bun test in spawned procs: 58ms steady (was 59-60), isolated cli proc 71→51ms (-28%)
- Final stop: 61ms steady, ideas.md updated with dead ends. Session: 98→61ms (-38%), 100/100 cov.
- Update floor analysis after run #48 keep (60→57ms)
- Hoist Bun.spawn to top-level in check-coverage.ts: 60ms→57ms (-5%)
- Prune autoresearch backlog after 14 experiments at floor
- Ideas backlog for UT coverage gate optimization
- Cover me.ts L37 (invalid JWT payload returns 401-shape body): worker 100/99.44 → 100/100; total within-noise 62→64ms (kept for coverage win)
- Cover json-input.ts stdin paths via fs.readFileSync spy: cli 96.88/98.14 → 100/100, total wall 77→62ms (best-of-7 with warmup)
- Skip bash -c wrapper in check-coverage.ts: 93→77ms (-17%)
- Cover api-key-auth .catch + me.ts JSON.parse catch: worker_funcs 95.83→100, lines 98.89→99.44
- Add UT runtime+coverage benchmark for autoresearch
- Add hospitals + doctors CRUD specs
- Add assets CRUD spec
- Add insurers CRUD spec
- Add L3 browser E2E job + playwright config hardening
- Document L1 threshold uplift + L2 HTTP + L3 Playwright
- Add L2 HTTP suite to pre-push gate
- Export canonical INIT_SQL for non-drizzle provisioners

### Fixed
- Override postcss to ^8.5.10
- Narrow Bun.spawn stdout/stderr types after upstream Bun bump
- Add production guard to E2E_SKIP_AUTH
- Prevent Host header spoofing in isLocalhost

## v2.0.0

### Added
- Add L2 hono e2e suite covering crud + auth boundary
- Extend coverage gate to web/cli/worker with 2-dim threshold
- Add coverage, renewals, dashboard read-only commands
- Add policies command with payments/beneficiaries/coverage-items/attachments
- Add flat entity commands via defineCrudCommand factory
- Scaffold @nocoo/surety with auth commands
- Accept `?callback` as alias for `?callback_url` on /api/auth/cli
- Split API onto surety-api.hexly.ai for Bearer clients
- Show Access user email in sidebar via /api/me
- Add /api/me returning Access user info
- Add E2E_SKIP_AUTH binding for test environment
- Add /api/auth/cli CLI token mint endpoint
- Vite dev proxy to prod Worker with bearer token injection
- Bypass auth on localhost host for local dev
- Create Vite React SPA with migrated components
- Rewrite as Hono API server with D1 direct binding
- Add D1 binding driver support

### Changed
- Bump version to 2.0.0 for first npm release
- Prune web_legacy from architecture docs and quality matrix
- Hoist build scripts and drizzle config to repo root
- Record post-S MCP cleanup round in docs/17
- Refresh architecture docs to reflect Vite + Hono + CLI stack
- Document upgraded six-tier quality system
- Apply strict eslint to apps/worker + ban .skip/.only
- Backfill coverage for policies/json-input/client and access-auth jwt branch
- Run gitleaks at pre-commit for early secret detection
- Swap broken legacy e2e for worker+cli tests in pre-push
- Correct README to match real output shape and --data input contract
- Promote surety CLI from planned to shipped across root docs
- Add README with install, config, and command reference
- Align plan with real worker capabilities and shipped cli state
- Revise CLI replacement plan (align with Worker API, fix phase ordering)
- Plan CLI replacement for MCP (@nocoo/surety)
- Bind custom domains and E2E_SKIP_AUTH var
- Settings page has no token UI at all
- Flag UI migration record as historical
- Correct CLI token flow — only loopback endpoint exists
- Rewrite README for Vite SPA + Hono Worker architecture
- Commit static logo and favicon assets
- Restructure test scripts for new architecture
- Replace DB-direct tool tests with HTTP client + guard tests
- Add fetchAPI smoke tests
- Add middleware unit tests
- Stop tracking Vite build output in worker/static
- Update root scripts for Vite + Worker architecture
- Switch to HTTP API client
- Rename apps/web to apps/web_legacy

### Fixed
- Gate token-management routes on session auth, scope to caller email
- Verify bearer token on localhost bypass so /api/me works locally
- Funnel api errors through emitError for stable JSON stderr contract
- Propagate bearer token email to context so /api/me works for CLI
- Separate loginUrl (CF Access) from apiUrl (Bearer)
- Stub bun:sqlite so wrangler can bundle @surety/db
- Use bun run in root dev/build scripts
- Add missing is-localhost helper
- Align bg-card usage to B05 luminance spec

### Removed
- Delete apps/web_legacy/ and Next.js dependencies
- Drop legacy Next.js E2E (Playwright) suite
- Remove MCP access settings UI and e2e
- Drop MCP residue from infra config
- Remove MCP references from CLAUDE.md and .env.example
- Remove MCP sections, add CLI placeholder
- Remove MCP setup and CRUD tools guides (superseded by docs/16)
- Delete packages/mcp and remove MCP scripts
- Remove MCP settings card from settings page
- Remove obsolete Google OAuth setup guide

## v1.6.0

### Changed
- Clean up root files and update README for monorepo
- Finalize monorepo configuration
- Move worker to apps/worker
- Move Next.js app to apps/web
- Extract packages/mcp
- Extract packages/api as framework-agnostic business layer
- Extract packages/db
- Scaffold monorepo workspace structure

### Fixed
- Align test:coverage with test command globs, add services to coverage
- Move eslint config to repo root to cover all packages
- Address 4 monorepo integration issues

## v1.5.10

### Added
- Remove two-factor authentication (2FA/TOTP) feature
- Add bearer token auth to all API routes
- Add CLI login endpoint and token management API
- Add bearer token authentication middleware
- Add api_tokens table and repository
- Align /api/live to surety health standard
- Add automated release script (#28)

### Changed
- Pre-commit/pre-push optimization session summary in autoresearch.ideas.md
- Parallel scrypt verifies in recovery roundtrip: 963→900ms (-6.5%, cooled trials)
- Full describe.concurrent in totp-module: 997→963ms (-3.4%)
- Parallelize seed-remote subprocess guards: 1080→997ms (-7.7%, sub-1s!)
- Describe.concurrent for TotpService scrypt-bound blocks: 1267→1080ms (-15%)
- Re-baseline pre-commit: 1267ms (test 1267, lint 592, typecheck 925), wall=test
- Baseline pre-push (sequential): osv-scanner 4114ms + gitleaks 89ms = 4216ms
- Enable eslint --cache: lint 4139→646ms warm, total 4140→1393ms (-66%)
- Parallelize pre-commit steps: 6087→4140ms (-32%), bottleneck is lint at ~4s
- Pre-commit total 6087ms (test 1210, lint 3983, typecheck 894). Best-of-3 trials.
- Add integration tests for token lifecycle and requireAuth
- Add unit tests for API token auth
- 添加 Attachments E2E 测试，L2 覆盖率达到 100% (74/74 端点)
- 添加 2FA E2E 测试覆盖 (5 个端点: status, setup, verify-setup, disable, verify-2fa)
- Consolidate dashboard-vm tests (864→857)
- Consolidate redundant tests (920→865, 1171→993ms)
- 920 tests, 1171ms, 93.31% coverage
- Add coverageInclude to exclude React/UI components from coverage
- Cover findByMemberId in beneficiaries repo
- Cover findByMemberId in beneficiaries repo (others.test.ts)
- Cover countGroupedByPolicyIds in attachments repo
- Ignore GHSA-458j-xx4x-4375 hono medium CVE

### Fixed
- Update MCP E2E test expectations and seed-remote timestamp
- Move legacy totp test key from shared seed to E2E-only
- Avoid Response singleton reuse, strengthen legacy key test
- Filter legacy totp.* keys from Settings API
- Revoke all API tokens when 2FA is enabled
- Exclude sensitive routes from Bearer passthrough
- Block 2FA users from CLI token issuance
- Allow Bearer token passthrough to route handlers
- Fix last no-non-null-assertion lint error
- Remove redundant requireAuth integration test (covered by api-auth.test.ts)
- Fix TypeScript strict mode errors in integration tests
- Close bearer-token bypass and require auth on settings/backup routes
- Assert DELETE cascade behavior instead of statement count
- Cover asset enrichment branch in policies GET handler
- Assert minus sign in negative currency formatting
- Upgrade hono to fix GHSA-458j-xx4x-4375
- Remove bg-input/border-input anti-patterns from button, switch, toggle (#26)
- Migrate TagInput to bg-secondary + border-border
- Migrate L3 controls from bg-input to bg-secondary + border-border

### Removed
- Remove stale hono CVE ignores from osv-scanner.toml
