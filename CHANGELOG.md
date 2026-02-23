# Changelog

All notable changes to this project will be documented in this file.

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
- **Pre-commit** (UT) and **pre-push** (UT + Lint + E2E) hooks via Husky

### Infrastructure

- Next.js 16 App Router with TypeScript strict mode
- SQLite + Drizzle ORM with Bun runtime
- Railway deployment support with Docker and SQLite volume mount
- Database protection guards preventing accidental production data loss
- CSV import script for real policy data migration
