# MCP Server Configuration Guide

Surety provides [MCP (Model Context Protocol)](https://modelcontextprotocol.io) integration, allowing AI assistants to query and manage your family insurance data through natural language.

## Overview

MCP is a standard protocol that enables AI assistants (Claude Code, Cursor, etc.) to connect to external data sources. Surety's MCP server exposes **full CRUD tools** for managing members, policies, assets, insurers, beneficiaries, payments, cash values, coverage items, and analytics.

**Key security properties:**

- MCP is **disabled by default** — you must explicitly enable it
- Communication uses **stdio transport** — data stays on your local machine
- Delete operations enforce **FK reference safety** at the application layer
- Settings are **not exposed** via MCP (security-sensitive)

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

### Members (5 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-members` | List all family members | None |
| `get-member` | Get member details with related policies | `memberId: number` |
| `create-member` | Create a new family member | `name`, `relation`, `gender?`, `birthDate?`, `idCard?`, `idType?`, `idExpiry?`, `phone?`, `hasSocialInsurance?` |
| `update-member` | Update an existing family member | `memberId`, + optional fields |
| `delete-member` | Delete a member (fails if referenced) | `memberId` |

### Policies (5 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-policies` | List policies with optional filters | `status?`, `category?`, `memberId?` |
| `get-policy` | Get full policy details with beneficiaries | `policyId: number` |
| `create-policy` | Create a new insurance policy | `insuredType`, `insurerName`, + required fields |
| `update-policy` | Update an existing policy | `policyId`, + optional fields |
| `delete-policy` | Delete policy and cascade child records | `policyId` |

### Assets (5 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-assets` | List all insured assets | None |
| `get-asset` | Get asset details with owner info | `assetId: number` |
| `create-asset` | Create a new insured asset | `type`, `name`, `identifier`, `ownerId?`, `details?` |
| `update-asset` | Update an existing asset | `assetId`, + optional fields |
| `delete-asset` | Delete an asset (fails if referenced) | `assetId` |

### Insurers (5 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-insurers` | List all insurance companies | None |
| `get-insurer` | Get insurer details | `insurerId: number` |
| `create-insurer` | Create a new insurer | `name`, `phone?`, `website?` |
| `update-insurer` | Update insurer (syncs name to policies) | `insurerId`, + optional fields |
| `delete-insurer` | Delete insurer (fails if referenced) | `insurerId` |

### Beneficiaries (5 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-beneficiaries` | List beneficiaries for a policy | `policyId: number` |
| `get-beneficiary` | Get beneficiary details | `beneficiaryId: number` |
| `create-beneficiary` | Add a beneficiary to a policy | `policyId`, `sharePercent`, `rankOrder`, `memberId?`, `externalName?` |
| `update-beneficiary` | Update a beneficiary record | `beneficiaryId`, + optional fields |
| `delete-beneficiary` | Remove a beneficiary | `beneficiaryId` |

### Payments (5 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-payments` | List payment records for a policy | `policyId: number` |
| `get-payment` | Get payment record details | `paymentId: number` |
| `create-payment` | Add a payment record | `policyId`, `periodNumber`, `dueDate`, `amount`, `status?`, `paidDate?`, `paidAmount?` |
| `update-payment` | Update a payment record | `paymentId`, + optional fields |
| `delete-payment` | Remove a payment record | `paymentId` |

### Cash Values (4 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-cash-values` | List cash values for a policy | `policyId: number` |
| `create-cash-value` | Add a cash value record | `policyId`, `policyYear`, `value` |
| `update-cash-value` | Update a cash value record | `cashValueId`, `policyYear?`, `value?` |
| `delete-cash-value` | Remove a cash value record | `cashValueId` |

### Coverage Items (4 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-coverage-items` | List coverage items for a policy | `policyId: number` |
| `create-coverage-item` | Add a coverage item to a policy | `policyId`, `name`, `periodLimit?`, `lifetimeLimit?`, `deductible?`, `coveragePercent?`, `isOptional?`, `notes?`, `sortOrder?` |
| `update-coverage-item` | Update a coverage item | `coverageItemId`, + optional fields |
| `delete-coverage-item` | Remove a coverage item | `coverageItemId` |

### Analytics (3 tools)

| Tool | Description | Parameters |
|------|-------------|------------|
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
- "Add a new family member: Li Si, spouse, born 1990-03-15"
- "Create a new life insurance policy for Zhang San with China Life"
- "Update the premium for policy POL-001 to 5000"
- "Add a beneficiary to policy POL-001: Li Si, 100% share, rank 1"

## Troubleshooting

### "MCP access is disabled" error

The MCP toggle in Settings is off. Open [http://localhost:7015/settings](http://localhost:7015/settings) and enable it.

### AI assistant can't find the MCP server

1. Make sure `bun` is installed and available in your PATH
2. Verify the path to `mcp/index.ts` is correct (use absolute path)
3. Restart the AI assistant after changing MCP configuration

### Tools return empty data

Make sure your Surety database has data. The MCP server reads from the same Cloudflare D1 database as the web UI.

### Environment Override (Advanced)

For testing or automation, you can bypass the settings toggle by setting an environment variable:

```bash
SURETY_MCP_ENABLED=true bun run mcp/index.ts
```

This is useful for CI/CD or scripted testing scenarios. In normal use, prefer the Settings page toggle.
