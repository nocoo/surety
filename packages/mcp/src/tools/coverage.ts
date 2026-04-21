/**
 * MCP Tools: Coverage & Analytics
 *
 * Tools for coverage analysis, renewal overview, and dashboard summary.
 * Uses the Worker API's coverage-lookup, renewal-calendar, and dashboard endpoints.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

export function registerCoverageTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // coverage-analysis
  // -------------------------------------------------------------------------
  server.tool(
    "coverage-analysis",
    "Analyze insurance coverage for a specific family member or asset",
    {
      type: z
        .enum(["member", "asset"])
        .describe("Whether to analyze a member or asset"),
      id: z.number().describe("The member or asset ID"),
    },
    async ({ type, id }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const data = await apiGet(
          `/api/coverage-lookup?type=${type}&id=${id}`,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data) }],
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
  // renewal-overview
  // -------------------------------------------------------------------------
  server.tool(
    "renewal-overview",
    "Get an overview of upcoming policy renewals and due dates",
    {
      months: z
        .number()
        .optional()
        .describe("Number of months to look ahead (default: 12)"),
    },
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const data = await apiGet("/api/renewal-calendar");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data) }],
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
  // dashboard-summary
  // -------------------------------------------------------------------------
  server.tool(
    "dashboard-summary",
    "Get a summary of the family insurance dashboard including key statistics",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const data = await apiGet("/api/dashboard");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data) }],
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
