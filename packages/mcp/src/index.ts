#!/usr/bin/env bun
/**
 * Surety MCP Server Entry Point
 *
 * This file is the main entry point for the MCP server.
 * External AI agents (Claude Code, Cursor, etc.) connect to this
 * via stdio transport by spawning: `bun run mcp/index.ts`
 *
 * Configuration example for Claude Code / Cursor:
 * {
 *   "mcpServers": {
 *     "surety": {
 *       "command": "bun",
 *       "args": ["run", "/path/to/surety/mcp/index.ts"]
 *     }
 *   }
 * }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { APP_VERSION } from "@surety/api/lib/version";
import { registerTools } from "./server";

const server = new McpServer({
  name: "surety",
  version: APP_VERSION,
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
