/**
 * Agent-oriented CLI guide printed by `surety --skill` / `surety skill`.
 * Keep sections discrete so tests can assert required topics stay present.
 */

export const SKILL_HEADING = "# Surety CLI — Agent Guide";

const SECTIONS = {
	overview: `## What Surety is

Surety is a self-hosted family insurance and records app: one shared household instance (not per-user tenants) for members, insurers, assets, hospitals, doctors, medical visits, and policies. The \`surety\` CLI is the machine-facing interface: HTTP to the Worker API, JSON on stdout.`,

	auth: `## Authentication and configuration

| Task | Command |
|------|---------|
| Sign in (browser / CF Access) | \`surety login\` |
| Clear local session fields | \`surety logout\` (does not prove server-side token revocation) |
| Show identity | \`surety whoami\` |

Config file: \`~/.config/surety/config.json\` (or \`config.dev.json\` when \`SURETY_CLI_DEV=1\`).

| Key | Role |
|-----|------|
| \`apiUrl\` | Data-plane origin (Bearer token) |
| \`loginUrl\` | CF Access origin that mints CLI tokens (never the dev SPA host) |
| \`token\` | Bearer API token |
| \`email\` | Authenticated email |

Environment overrides (highest priority): \`SURETY_API_TOKEN\`, \`SURETY_API_URL\`, \`SURETY_LOGIN_URL\`.`,

	output: `## Output contract

- Success: exactly one JSON value on **stdout** (object or array).
- Default mode: compact summary per record; add \`--full\` for the complete API payload.
- Failure: exit code **1**, one JSON line on **stderr**: \`{"ok":false,"error":"...","detail"?}\`.
- Do not parse human prose; use \`--help\` only for discovery.`,

	crud: `## Entity commands (CRUD pattern)

Flat resources share: \`ls\` | \`get <id>\` | \`add\` | \`update <id>\` | \`rm <id>\`.

| Command | API base |
|---------|----------|
| \`surety members …\` | \`/api/members\` |
| \`surety insurers …\` | \`/api/insurers\` |
| \`surety assets …\` | \`/api/assets\` |
| \`surety hospitals …\` | \`/api/hospitals\` |
| \`surety doctors …\` | \`/api/doctors\` |
| \`surety medical-visits …\` | \`/api/medical-visits\` |
| \`surety policies …\` | \`/api/policies\` (see nested sub-resources below) |

Read-only aggregates:

| Command | Purpose |
|---------|---------|
| \`surety coverage --type member|asset --id <n>\` | Coverage lookup |
| \`surety renewals\` | Renewal calendar |
| \`surety dashboard\` | Dashboard summary |`,

	jsonInput: `## JSON for \`add\` / \`update\`

Payload priority:

1. \`--data '<json>'\`
2. \`--data-file <path>\` (use \`-\` for stdin)
3. piped stdin when not a TTY

Positional JSON blobs are not accepted. Use \`--full\` on \`get\` / \`ls\` when you need every field.`,

	policies: `## Policies (nested)

\`surety policies ls|get|add|update|rm\` plus sub-resources: \`payments\`, \`beneficiaries\` (read-only), \`coverage-items\`, \`attachments\`. Run \`surety policies --help\` for the full tree.`,

	safety: `## Safety

- One family dataset: prefer list/get before destructive updates.
- \`loginUrl\` and \`apiUrl\` are separate; do not point login at the dev app host.
- JSON backup/export may contain sensitive data; R2 files and API tokens are not fully represented in JSON export.`,

	pointers: `## More documentation

- \`surety --help\` and \`surety <command> --help\`
- Repository: \`apps/cli/README.md\`
- Agent operations: \`docs/21-agent-operations.md\``,
} as const;

/** Section titles and bodies used in tests to guard required topics. */
export const SKILL_SECTION_MARKERS = {
	auth: "## Authentication and configuration",
	medicalVisits: "medical-visits",
	output: "## Output contract",
	envToken: "SURETY_API_TOKEN",
} as const;

export function buildAgentSkillDocument(): string {
	return [SKILL_HEADING, ...Object.values(SECTIONS)].join("\n\n");
}
