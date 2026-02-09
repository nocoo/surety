/**
 * MCP Tools: Assets
 *
 * Tools for querying insured property (real estate, vehicles).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assetsRepo, membersRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

export function registerAssetTools(server: McpServer): void {
  server.tool(
    "list-assets",
    "List all insured assets (real estate, vehicles) with owner information",
    {},
    async () => {
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const assets = assetsRepo.findAll();
      const result = assets.map((a) => {
        const owner = a.ownerId ? membersRepo.findById(a.ownerId) : undefined;
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          identifier: a.identifier,
          ownerName: owner?.name,
          details: a.details ? JSON.parse(a.details) : undefined,
        };
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
