/**
 * MCP Tools: Assets
 *
 * Tools for querying and managing insured property (real estate, vehicles).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined, validateJson } from "./shared";

export function registerAssetTools(server: McpServer): void {
  server.tool(
    "list-assets",
    "List all insured assets (real estate, vehicles) with owner information",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const assets = await apiGet("/api/assets");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(assets) }],
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
  // get-asset
  // -------------------------------------------------------------------------
  server.tool(
    "get-asset",
    "Get detailed information about a specific insured asset",
    { assetId: z.number().describe("The asset ID to look up") },
    async ({ assetId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const asset = await apiGet(`/api/assets/${assetId}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(asset) }],
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
  // create-asset
  // -------------------------------------------------------------------------
  server.tool(
    "create-asset",
    "Create a new insured asset (real estate or vehicle)",
    {
      type: z
        .enum(["RealEstate", "Vehicle"])
        .describe("Asset type"),
      name: z.string().describe("Asset name"),
      identifier: z
        .string()
        .describe("Identifier (plate number, address, etc.)"),
      ownerId: z.number().optional().describe("Owner member ID"),
      details: z
        .string()
        .optional()
        .describe("Additional details as JSON string"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Validate JSON format for details field
      if (args.details !== undefined) {
        const jsonError = validateJson(args.details);
        if (jsonError) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Invalid JSON in details field: ${jsonError}`,
              },
            ],
          };
        }
      }

      try {
        const asset = await apiPost("/api/assets", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(asset) }],
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
  // update-asset
  // -------------------------------------------------------------------------
  server.tool(
    "update-asset",
    "Update an existing insured asset",
    {
      assetId: z.number().describe("The asset ID to update"),
      type: z.enum(["RealEstate", "Vehicle"]).optional().describe("Asset type"),
      name: z.string().optional().describe("Asset name"),
      identifier: z.string().optional().describe("Identifier"),
      ownerId: z.number().optional().describe("Owner member ID"),
      details: z.string().optional().describe("Additional details as JSON string"),
    },
    async ({ assetId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Validate JSON format for details field
      if (data.details !== undefined) {
        const jsonError = validateJson(data.details);
        if (jsonError) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Invalid JSON in details field: ${jsonError}`,
              },
            ],
          };
        }
      }

      try {
        const updated = await apiPut(`/api/assets/${assetId}`, stripUndefined(data));
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
  // delete-asset
  // -------------------------------------------------------------------------
  server.tool(
    "delete-asset",
    "Delete an insured asset (fails if referenced by policies)",
    {
      assetId: z.number().describe("The asset ID to delete"),
    },
    async ({ assetId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/assets/${assetId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: assetId }),
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
