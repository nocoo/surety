<p align="center">
  <img src="../assets/brand/icon-rounded.png" width="128" alt="Surety logo" />
</p>
<h1 align="center">Surety</h1>
<p align="center">Organize household policies, coverage, payment schedules, and medical visits.</p>
<p align="center">
  <a href="https://surety.hexly.ai">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Surety manages household insurance records. Link family members, properties, vehicles, and insurers to policies, then look up coverage, find policy documents, and track payments, renewals, and medical visits.

A single Cloudflare Worker serves the React interface and Hono API. D1 stores structured records, while R2 stores policy attachments. Signed-in users of one instance share the same household data; records are not separated into households by email. Browsers sign in with Cloudflare Access, and the Bun CLI uses a separate Bearer API.

## Features

- Manage family members, insurers, properties, and vehicles, linking each policy to an insured person or asset.
- Maintain coverage items, insured amounts, premiums, and payment records; generate upcoming payments and look up coverage by member or asset.
- View premiums, coverage, and upcoming payments in the dashboard and renewal calendar. Record surrender, claim termination, lapse, and planned surrender.
- Upload, preview, and download PDF, JPEG, and PNG policy attachments, up to 50 MiB per file and 20 attachments per policy.
- Keep records of hospitals, doctors, and family medical visits.
- Export records as JSON and, after configuring Backy, push backups manually and inspect delivery history.

JSON exports include attachment metadata and settings, but exclude R2 files and API tokens. The current Worker restore route has not been connected to D1 batch transactions and is not a working database restore flow. See [backup scope](20-development.md#备份范围与恢复限制). The renewal calendar provides information on screen; there is no automatic email task.

## Usage

Open the [website](https://surety.hexly.ai) after receiving Access permission. Add family members and assets, then enter policies, coverage items, and payments. Policy details provide attachment management, status changes, and planned surrender.

The CLI requires [Bun](https://bun.sh):

```bash
bun add -g @nocoo/surety
surety login
surety members ls
surety policies ls
```

`login` opens an Access-protected browser flow and saves a token through a local callback. Data commands emit JSON: summaries by default, or complete API payloads with `--full`. Write commands accept `--data`, `--data-file`, or standard input.

The default login host is `surety.hexly.ai`; the data API is `surety-api.hexly.ai`. Hosting your own instance requires configuring both URLs and adapting the Worker's domain checks. Beneficiaries currently have read-only endpoints. The website can upload attachments; the CLI can query attachment metadata and delete attachments, which also attempts to remove their R2 files. See the [CLI README](../apps/cli/README.md) for commands and current limitations.

## Development

Install Bun and Node.js 22.12+. Bun manages workspace dependencies; Vite, Vitest, and Wrangler use Node.js.

```bash
git clone https://github.com/nocoo/surety.git
cd surety
bun install --frozen-lockfile
bun run build
```

By default, `bun run dev` starts only Vite and proxies `/api` to the hosted API. Configure your own `SURETY_API_URL` and development token using the [development guide](20-development.md#开发配置), then run:

```bash
bun run dev
```

Vite runs on port 7012; the repository's development entry is `https://surety.dev.hexly.ai`. `bun run dev:worker` can separately start a local Worker on 7016, but database initialization and authentication still need configuration. For local verification, use the test runners below, which initialize their own data.

The main code lives in `apps/web/`, `apps/worker/`, `apps/cli/`, `packages/api/`, and `packages/db/`. `build` writes the SPA to `apps/worker/static/`. The CLI runs TypeScript source directly, with no separate build step. See the development guide for deployment and schema management.

## Tests

Install workspace dependencies first:

```bash
bun run test
bun test apps/worker/__tests__/e2e --path-ignore-patterns __none__
bun run test:l2:http
bunx playwright install chromium
bun run test:e2e:browser
```

Vitest runs unit tests for the web app, Worker, CLI, and shared packages. The second command tests Hono integration with Bun's in-memory SQLite. The HTTP runner starts a local Worker on 7017 with separate D1 / R2 state. The browser runner builds the SPA, starts a local Worker on 27012, and uses Playwright Chromium.

Keep both ports free. HTTP and browser tests rebuild `apps/worker/.wrangler/state-l2-http` and `state-l3`, respectively, using synthetic data without production credentials. Reserve these directories for tests.

## Stack

| Technology | Purpose |
| --- | --- |
| TypeScript / Bun workspaces | Application code, CLI, and local tools |
| Vite / React / React Router / SWR | SPA, routing, and data fetching |
| Tailwind CSS / Radix UI / Basalt / Recharts | Styling, interface components, and charts |
| Hono / Cloudflare Workers | API, authentication middleware, and static assets |
| Drizzle ORM / Cloudflare D1 | Household, policy, and medical-visit data |
| Cloudflare R2 | Policy attachments |
| Cloudflare Access / `@nocoo/base-cli` | Browser authentication and CLI login |
| Vitest / Bun SQLite / Playwright | Unit, API integration, and browser tests |

## Documentation

- [Documentation index](README.md)
- [Development, authentication, and deployment](20-development.md)
- [CLI commands and output](../apps/cli/README.md)
- [Policy status rules](19-policy-status.md)

## License

[MIT](../LICENSE)
