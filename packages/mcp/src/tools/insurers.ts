/**
 * MCP Tools: Insurers
 *
 * Tools for managing insurance companies.
 * The Worker API handles name-sync to policies and FK restriction on delete.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerInsurerTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-insurers
  // -------------------------------------------------------------------------
  server.tool(
    "list-insurers",
    "List all insurance companies",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const insurers = await apiGet("/api/insurers");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(insurers) }],
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
  // get-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "get-insurer",
    "Get detailed information about an insurance company",
    { insurerId: z.number().describe("The insurer ID to look up") },
    async ({ insurerId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const insurer = await apiGet(`/api/insurers/${insurerId}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(insurer) }],
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
  // create-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "create-insurer",
    "Create a new insurance company",
    {
      name: z.string().describe("Company name (must be unique)"),
      phone: z.string().optional().describe("Contact phone"),
      website: z.string().optional().describe("Company website URL"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const insurer = await apiPost("/api/insurers", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(insurer) }],
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
  // update-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "update-insurer",
    "Update an insurance company. If name changes, syncs insurerName to all related policies.",
    {
      insurerId: z.number().describe("The insurer ID to update"),
      name: z.string().optional().describe("Company name"),
      phone: z.string().optional().describe("Contact phone"),
      website: z.string().optional().describe("Company website URL"),
    },
    async ({ insurerId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(`/api/insurers/${insurerId}`, stripUndefined(data));
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
  // delete-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "delete-insurer",
    "Delete an insurance company (fails if referenced by policies)",
    {
      insurerId: z.number().describe("The insurer ID to delete"),
    },
    async ({ insurerId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/insurers/${insurerId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: insurerId }),
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
