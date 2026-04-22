# @nocoo/surety

Surety CLI — AI-facing command line interface for managing household insurance policies.

Designed for AI agents (Claude Code, Cursor, etc.) to read and mutate Surety data through a stable, JSON-only contract. All output is machine-parsable; errors go to stderr as `{ ok: false, error }`.

## Requirements

- [Bun](https://bun.sh) 1.2+ (the CLI ships as `src/index.ts` and runs under Bun directly)

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
| `SURETY_CLI_DEV` | `=1` writes to `./.surety-dev/config.json` instead of `~/.config/surety` |

## Output contract

- Every command emits **one JSON object** on stdout.
- Summary mode (default): compact record with `id` + salient fields.
- Full mode (`--full`): complete upstream payload.
- On error: exit code 1, stderr `{ ok: false, error, details? }`.

```bash
surety members ls
# {"ok":true,"items":[{"id":1,"name":"张伟","relation":"self"}, ...]}

surety members get 1 --full
# {"ok":true,"item":{"id":1,"name":"张伟","relation":"self","birthDate":"...", ...}}
```

## Commands

### Auth
| Command | Description |
|---------|-------------|
| `surety login [--login-url] [--api-url] [--timeout]` | Browser-based login via CF Access, saves token |
| `surety logout` | Forget saved token and email |
| `surety whoami` | Print authenticated identity |

### Flat entities (CRUD)

All follow the same shape: `ls`, `get <id>`, `add <json>`, `update <id> <json>`, `rm <id>`.

| Command | Path |
|---------|------|
| `surety members …` | `/api/members` |
| `surety insurers …` | `/api/insurers` |
| `surety assets …` | `/api/assets` |
| `surety hospitals …` | `/api/hospitals` |
| `surety doctors …` | `/api/doctors` |
| `surety medical-visits …` | `/api/medical-visits` |

### Policies (with nested sub-resources)

```bash
surety policies ls
surety policies get <id> [--full]
surety policies add '<json>'
surety policies update <id> '<json>'
surety policies rm <id>

# Payments
surety policies payments ls <policyId>
surety policies payments add <policyId> '<json>'
surety policies payments update <policyId> <paymentId> '<json>'
surety policies payments rm <policyId> <paymentId>
surety policies payments generate <policyId>

# Beneficiaries (read-only in current Worker)
surety policies beneficiaries ls <policyId>

# Coverage items (full CRUD)
surety policies coverage-items ls <policyId>
surety policies coverage-items add <policyId> '<json>'
surety policies coverage-items update <policyId> <itemId> '<json>'
surety policies coverage-items rm <policyId> <itemId>

# Attachments (metadata only; upload not yet exposed in Worker)
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

## Known backend gaps

These endpoints are not yet implemented in the Worker; the CLI will expose them once shipped:

- `PUT/DELETE /api/policies/:id/beneficiaries` — beneficiaries are currently read-only
- `POST /api/policies/:id/attachments` — attachment upload
- `GET /api/policies/:id` does not nest sub-resources; use the sub-resource `ls` commands

## AI usage examples

```bash
# Find the active health policy for 张伟
surety members ls                                                   # discover member id
surety coverage --type member --id 1                                # list policies
surety policies get 3 --full                                        # inspect one

# Record a new out-of-pocket payment
surety policies payments add 3 '{"amount":1200,"paidAt":"2026-04-01","note":"annual premium"}'

# Regenerate upcoming payment schedule after policy change
surety policies payments generate 3
```

## Development

```bash
# From repo root
cd apps/cli
bun install
bun test
bun run typecheck
```

The CLI has no build step — `bin` in `package.json` points directly at `src/index.ts`.

## License

MIT
