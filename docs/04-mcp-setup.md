# MCP Server Configuration Guide

Surety provides [MCP (Model Context Protocol)](https://modelcontextprotocol.io) integration, allowing AI assistants to query your family insurance data through natural language.

## Overview

MCP is a standard protocol that enables AI assistants (Claude Code, Cursor, etc.) to connect to external data sources. Surety's MCP server exposes **read-only** tools for querying members, policies, assets, and coverage analytics.

**Key security properties:**

- MCP is **disabled by default** — you must explicitly enable it
- All tools are **read-only** — no data can be modified through MCP
- Communication uses **stdio transport** — data stays on your local machine

## Step 1: Enable MCP Access in Surety

1. Open Surety at [http://localhost:7015](http://localhost:7015)
2. Navigate to **Settings** (gear icon in sidebar)
3. Find the **MCP 访问** card and turn on the toggle switch
4. The page will show a JSON config snippet — you'll use this in Step 2

> Without enabling this toggle, all MCP tool calls will return an error message with guidance.

## Step 2: Configure Your AI Assistant

### Claude Code

Edit `~/.claude/claude_code_config.json` (or create it):

```json
{
  "mcpServers": {
    "surety": {
      "command": "bun",
      "args": ["run", "mcp/index.ts"],
      "cwd": "/path/to/surety"
    }
  }
}
```

Replace `/path/to/surety` with the actual absolute path to your Surety project directory.

### Cursor

Open Cursor Settings → MCP Servers → Add Server:

```json
{
  "mcpServers": {
    "surety": {
      "command": "bun",
      "args": ["run", "/path/to/surety/mcp/index.ts"]
    }
  }
}
```

### Other MCP-Compatible Clients

Any client that supports MCP stdio transport can connect. The general pattern is:

- **Command**: `bun`
- **Args**: `["run", "/path/to/surety/mcp/index.ts"]`
- **Transport**: stdio

## Step 3: Verify the Connection

After configuring your AI assistant, test the connection by asking it a question like:

> "List all family members in my insurance system"

If MCP is properly connected and enabled, the assistant will call the `list-members` tool and return your family member data.

If you see an error about "MCP access is disabled", go back to Step 1 and make sure the toggle is on.

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-members` | List all family members | None |
| `get-member` | Get member details with related policies | `memberId: number` |
| `list-policies` | List policies with optional filters | `status?`, `category?`, `memberId?` |
| `get-policy` | Get full policy details with beneficiaries | `policyId: number` |
| `list-assets` | List all insured assets | None |
| `coverage-analysis` | Analyze coverage for a member or asset | `type: "member" \| "asset"`, `id: number` |
| `renewal-overview` | Show upcoming renewals | `months?: number` (default: 12) |
| `dashboard-summary` | Overall insurance dashboard stats | None |

### Example Conversations

Once connected, you can ask your AI assistant things like:

- "What insurance coverage does Zhang San have?"
- "Show me all active life insurance policies"
- "Which policies are renewing in the next 3 months?"
- "Give me an overview of our family's total insurance coverage"
- "What's the coverage on our Tesla?"

## Troubleshooting

### "MCP access is disabled" error

The MCP toggle in Settings is off. Open [http://localhost:7015/settings](http://localhost:7015/settings) and enable it.

### AI assistant can't find the MCP server

1. Make sure `bun` is installed and available in your PATH
2. Verify the path to `mcp/index.ts` is correct (use absolute path)
3. Restart the AI assistant after changing MCP configuration

### Tools return empty data

Make sure your Surety database has data. The MCP server reads from the same SQLite database as the web UI.

### Environment Override (Advanced)

For testing or automation, you can bypass the settings toggle by setting an environment variable:

```bash
SURETY_MCP_ENABLED=true bun run mcp/index.ts
```

This is useful for CI/CD or scripted testing scenarios. In normal use, prefer the Settings page toggle.
