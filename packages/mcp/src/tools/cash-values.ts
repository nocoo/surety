/**
 * MCP Tools: Cash Values
 *
 * Cash values are not exposed as a standalone API endpoint.
 * They are managed as part of the policy detail view in the web UI.
 * These MCP tools are retained as stubs to maintain backward compatibility
 * with existing MCP clients, but they return informative messages directing
 * users to manage cash values via the policy detail page.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

const NOT_AVAILABLE =
  "Cash value management is not available via MCP. " +
  "Please use the Surety web UI policy detail page to view and manage cash values.";

export function registerCashValueTools(server: McpServer): void {
  server.tool(
    "list-cash-values",
    "List cash value records for a specific policy (not available via API — use web UI)",
    {
      policyId: z.number().describe("The policy ID to list cash values for"),
    },
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      return {
        isError: true,
        content: [{ type: "text" as const, text: NOT_AVAILABLE }],
      };
    },
  );

  server.tool(
    "create-cash-value",
    "Add a cash value record to a policy (not available via API — use web UI)",
    {
      policyId: z.number().describe("The policy ID to add a cash value to"),
      policyYear: z.number().describe("Policy year (e.g. 1, 2, 3...)"),
      value: z.number().describe("Cash value amount at that policy year"),
    },
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      return {
        isError: true,
        content: [{ type: "text" as const, text: NOT_AVAILABLE }],
      };
    },
  );

  server.tool(
    "update-cash-value",
    "Update a cash value record (not available via API — use web UI)",
    {
      cashValueId: z.number().describe("The cash value ID to update"),
      policyYear: z.number().optional().describe("Policy year"),
      value: z.number().optional().describe("Cash value amount"),
    },
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      return {
        isError: true,
        content: [{ type: "text" as const, text: NOT_AVAILABLE }],
      };
    },
  );

  server.tool(
    "delete-cash-value",
    "Remove a cash value record (not available via API — use web UI)",
    {
      cashValueId: z.number().describe("The cash value ID to delete"),
    },
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      return {
        isError: true,
        content: [{ type: "text" as const, text: NOT_AVAILABLE }],
      };
    },
  );
}
