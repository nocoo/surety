/**
 * MCP Tools: Coverage Items
 *
 * Tools for managing policy coverage/benefit items.
 * Coverage items are always scoped to a specific policy.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerCoverageItemTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-coverage-items
  // -------------------------------------------------------------------------
  server.tool(
    "list-coverage-items",
    "List coverage/benefit items for a specific policy",
    {
      policyId: z.number().describe("The policy ID to list coverage items for"),
    },
    async ({ policyId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const items = await apiGet(`/api/policies/${policyId}/coverage-items`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(items) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // create-coverage-item
  // -------------------------------------------------------------------------
  server.tool(
    "create-coverage-item",
    "Add a coverage/benefit item to a policy",
    {
      policyId: z.number().describe("The policy ID to add coverage to"),
      name: z.string().describe("Coverage item name (e.g. 'General Medical Insurance')"),
      periodLimit: z.number().optional().describe("Coverage period limit amount"),
      lifetimeLimit: z.number().optional().describe("Lifetime coverage limit amount"),
      deductible: z.number().optional().describe("Deductible amount"),
      coveragePercent: z.number().optional().describe("Coverage percentage (e.g. 100 for 100%)"),
      isOptional: z.boolean().optional().describe("Whether this coverage is optional"),
      notes: z.string().optional().describe("Additional notes"),
      sortOrder: z.number().optional().describe("Display sort order (default: 0)"),
    },
    async ({ policyId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const item = await apiPost(
          `/api/policies/${policyId}/coverage-items`,
          stripUndefined(data),
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(item) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // update-coverage-item
  // -------------------------------------------------------------------------
  server.tool(
    "update-coverage-item",
    "Update a coverage/benefit item",
    {
      policyId: z.number().describe("The policy ID the coverage item belongs to"),
      coverageItemId: z.number().describe("The coverage item ID to update"),
      name: z.string().optional().describe("Coverage item name"),
      periodLimit: z.number().optional().describe("Coverage period limit amount"),
      lifetimeLimit: z.number().optional().describe("Lifetime coverage limit amount"),
      deductible: z.number().optional().describe("Deductible amount"),
      coveragePercent: z.number().optional().describe("Coverage percentage"),
      isOptional: z.boolean().optional().describe("Whether this coverage is optional"),
      notes: z.string().optional().describe("Additional notes"),
      sortOrder: z.number().optional().describe("Display sort order"),
    },
    async ({ policyId, coverageItemId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(
          `/api/policies/${policyId}/coverage-items/${coverageItemId}`,
          stripUndefined(data),
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(updated) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // delete-coverage-item
  // -------------------------------------------------------------------------
  server.tool(
    "delete-coverage-item",
    "Remove a coverage/benefit item (no FK restrictions)",
    {
      policyId: z.number().describe("The policy ID the coverage item belongs to"),
      coverageItemId: z.number().describe("The coverage item ID to delete"),
    },
    async ({ policyId, coverageItemId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/policies/${policyId}/coverage-items/${coverageItemId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: coverageItemId }),
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );
}
