# Changelog

All notable changes to this project will be documented in this file.

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
