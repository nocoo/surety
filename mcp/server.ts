/**
 * MCP Server Registration
 *
 * Registers all tools with the McpServer instance.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMemberTools } from "./tools/members";
import { registerPolicyTools } from "./tools/policies";
import { registerAssetTools } from "./tools/assets";
import { registerCoverageTools } from "./tools/coverage";

export function registerTools(server: McpServer): void {
  registerMemberTools(server);
  registerPolicyTools(server);
  registerAssetTools(server);
  registerCoverageTools(server);
}
