/**
 * MCP Tools: Assets
 *
 * Tools for querying and managing insured property (real estate, vehicles).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assetsRepo, membersRepo, policiesRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

/** Strip keys with undefined values (for exactOptionalPropertyTypes compat) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: Record<string, unknown>): any {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

export function registerAssetTools(server: McpServer): void {
  server.tool(
    "list-assets",
    "List all insured assets (real estate, vehicles) with owner information",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const assets = await assetsRepo.findAll();
      const result = await Promise.all(
        assets.map(async (a) => {
          const owner = a.ownerId ? await membersRepo.findById(a.ownerId) : undefined;
          return {
            id: a.id,
            name: a.name,
            type: a.type,
            identifier: a.identifier,
            ownerName: owner?.name,
            details: a.details ? JSON.parse(a.details) : undefined,
          };
        }),
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      const asset = await assetsRepo.findById(assetId);
      if (!asset) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Asset with id ${assetId} not found`,
            },
          ],
        };
      }

      const owner = asset.ownerId
        ? await membersRepo.findById(asset.ownerId)
        : undefined;

      const result = {
        ...asset,
        ownerName: owner?.name,
        details: asset.details ? JSON.parse(asset.details) : undefined,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      const asset = await assetsRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(asset) }],
      };
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

      const updated = await assetsRepo.update(assetId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Asset with id ${assetId} not found`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(updated) }],
      };
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

      const asset = await assetsRepo.findById(assetId);
      if (!asset) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Asset with id ${assetId} not found`,
            },
          ],
        };
      }

      // Check referencing policies (policies.insuredAssetId → assets.id)
      const allPolicies = await policiesRepo.findAll();
      const referencingPolicies = allPolicies.filter(
        (p) => p.insuredAssetId === assetId,
      );

      if (referencingPolicies.length) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Cannot delete asset: still referenced by policies",
                policies: referencingPolicies.map((p) => ({
                  id: p.id,
                  policyNumber: p.policyNumber,
                })),
              }),
            },
          ],
        };
      }

      await assetsRepo.delete(assetId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: assetId }),
          },
        ],
      };
    },
  );
}
