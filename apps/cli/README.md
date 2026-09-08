# @nocoo/surety

Surety CLI — AI-facing command line interface for managing household insurance policies.

Designed for AI agents (Claude Code, Cursor, etc.) to read and mutate Surety data through a stable, JSON-only contract. All output is machine-parsable; errors go to stderr as `{ ok: false, error }`.

## Requirements

- [Bun](https://bun.sh) (the CLI ships as `src/index.ts` and runs under Bun directly)

## Install

```bash
bun add -g @nocoo/surety
# or one-shot
bunx @nocoo/surety --help
```

## Quick start

```bash
# 1. Log in via browser (CF Access -> /api/auth/cli -> loopback token)
surety login

# 2. Confirm identity
surety whoami

# 3. List household members
surety members ls
```

## Configuration

Config file: `~/.config/surety/config.json`

| Key | Description |
|-----|-------------|
| `apiUrl` | Data-plane origin (Bearer token). Default `https://surety-api.hexly.ai` |
| `loginUrl` | CF-Access-protected origin that mints CLI tokens. Default `https://surety.hexly.ai` |
| `token` | Bearer token (set by `surety login`) |
| `email` | Authenticated email (set by `surety login`) |

Environment overrides (highest priority):

| Env | Overrides |
|-----|-----------|
| `SURETY_API_URL` | `apiUrl` |
| `SURETY_LOGIN_URL` | `loginUrl` |
| `SURETY_API_TOKEN` | `token` |
| `SURETY_CLI_DEV` | `=1` or `true` selects `~/.config/surety/config.dev.json` in the current source; it does not change API URLs |

## Output contract

- Every command emits **one JSON value** on stdout (object or array, depending on command).
- Summary mode (default): compact projection of each record.
- Full mode (`--full`): the complete upstream payload.
- On error: exit code 1, stderr one-line `{ ok: false, error, detail? }`.

```bash
surety members ls
# [{"id":1,"name":"张伟","relation":"self"}, ...]

surety members get 1 --full
# {"id":1,"name":"张伟","relation":"self","birthDate":"...", ...}

surety members rm 999
# stderr: {"ok":false,"error":"api error: 404 DELETE /api/members/999","detail":{"error":"not found"}}
# exit 1
```

## JSON input for `add` / `update`

Mutating commands take the payload via one of (in priority order):

1. `--data '<inline json>'`
2. `--data-file <path>` (use `-` to read from stdin)
3. piped stdin (when not a TTY)

Positional JSON arguments are **not** accepted.

## Commands

### Auth
| Command | Description |
|---------|-------------|
| `surety login [--login-url] [--api-url] [--timeout]` | Browser-based login via CF Access, saves token |
| `surety logout` | Requests local sign-out; see the configuration-write limitation below |
| `surety whoami` | Print authenticated identity |

### Flat entities (CRUD)

All follow the same shape:

- `ls` — list all
- `get <id>` — fetch one
- `add --data '<json>'` — create (also `--data-file <path>` / stdin)
- `update <id> --data '<json>'` — replace
- `rm <id>` — delete

| Command | Path |
|---------|------|
| `surety members …` | `/api/members` |
| `surety insurers …` | `/api/insurers` |
| `surety assets …` | `/api/assets` |
| `surety hospitals …` | `/api/hospitals` |
| `surety doctors …` | `/api/doctors` |
| `surety medical-visits …` | `/api/medical-visits` |

### Policies (with nested sub-resources)

```text
surety policies ls
surety policies get <id> [--full]
surety policies add --data '<json>'
surety policies update <id> --data '<json>'
surety policies rm <id>

# Payments
surety policies payments ls <policyId>
surety policies payments add <policyId> --data '<json>'
surety policies payments update <policyId> <paymentId> --data '<json>'
surety policies payments rm <policyId> <paymentId>
surety policies payments generate <policyId>

# Beneficiaries (read-only in current Worker)
surety policies beneficiaries ls <policyId>

# Coverage items (full CRUD)
surety policies coverage-items ls <policyId>
surety policies coverage-items add <policyId> --data '<json>'
surety policies coverage-items update <policyId> <itemId> --data '<json>'
surety policies coverage-items rm <policyId> <itemId>

# Attachments (query metadata or delete attachments; upload through the website or Worker API)
surety policies attachments ls <policyId>
surety policies attachments get <policyId> <attachmentId>
surety policies attachments rm <policyId> <attachmentId>
```

### Read-only

| Command | Description |
|---------|-------------|
| `surety coverage --type <member\|asset> --id <id>` | Query `/api/coverage-lookup` |
| `surety renewals` | Upcoming renewals calendar |
| `surety dashboard` | Dashboard summary payload |

## Current limitations

Current boundaries:

- `PUT/DELETE /api/policies/:id/beneficiaries` — beneficiaries are currently read-only
- `POST /api/policies/:id/attachments` supports upload in the Worker, but the CLI has no upload subcommand. PDF, JPEG, and PNG are supported, up to 50 MiB per file and 20 files per policy.
- Attachment `rm` deletes the database record and attempts to remove the R2 file; an R2 deletion failure is not surfaced by the endpoint.
- `GET /api/policies/:id` does not nest sub-resources; use the sub-resource `ls` commands
- Policy termination and planned surrender have dedicated Worker endpoints and web controls, but no dedicated CLI subcommands.
- `logout` removes fields from an in-memory object before passing it to a merge-writing config manager. The stored token can remain. Revoke a token through the authenticated browser API and remove it from local configuration when ending access; a successful logout message is not server-side revocation.

See [current development and authentication notes](../../docs/20-development.md) for domain setup, configuration behavior, and database backup limitations.

## AI usage examples

```bash
# Find the active health policy for 张伟
surety members ls                                                   # discover member id
surety coverage --type member --id 1                                # list policies
surety policies get 3 --full                                        # inspect one

# Record a paid premium for an existing active policy (choose an unused period number)
surety policies payments add 3 --data '{"periodNumber":1,"dueDate":"2026-04-01","amount":1200,"status":"Paid","paidDate":"2026-04-01","paidAmount":1200}'

# Regenerate upcoming payment schedule after policy change
surety policies payments generate 3
```

## Development

```bash
# From repo root
bun install --frozen-lockfile
bun run test:cli
bun run --cwd apps/cli typecheck
```

The CLI has no build step — `bin` in `package.json` points directly at `src/index.ts`.

## License

MIT
