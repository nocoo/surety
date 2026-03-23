/**
 * MCP Tools: Coverage Items
 *
 * Tools for managing policy coverage/benefit items.
 * Coverage items are always scoped to a specific policy.
 * No FK restrict needed on delete — coverage items have no child references.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { coverageItemsRepo, policiesRepo } from "@/db/repositories";
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

      const policy = await policiesRepo.findById(policyId);
      if (!policy) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Policy with id ${policyId} not found`,
            },
          ],
        };
      }

      const items = await coverageItemsRepo.findByPolicyId(policyId);
      const result = items.map((ci) => ({
        id: ci.id,
        policyId: ci.policyId,
        name: ci.name,
        periodLimit: ci.periodLimit,
        lifetimeLimit: ci.lifetimeLimit,
        deductible: ci.deductible,
        coveragePercent: ci.coveragePercent,
        isOptional: ci.isOptional,
        notes: ci.notes,
        sortOrder: ci.sortOrder,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Validate policy exists
      const policy = await policiesRepo.findById(args.policyId);
      if (!policy) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Policy with id ${args.policyId} not found`,
            },
          ],
        };
      }

      const coverageItem = await coverageItemsRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(coverageItem) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-coverage-item
  // -------------------------------------------------------------------------
  server.tool(
    "update-coverage-item",
    "Update a coverage/benefit item",
    {
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
    async ({ coverageItemId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const updated = await coverageItemsRepo.update(coverageItemId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Coverage item with id ${coverageItemId} not found`,
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
  // delete-coverage-item
  // -------------------------------------------------------------------------
  server.tool(
    "delete-coverage-item",
    "Remove a coverage/benefit item (no FK restrictions)",
    {
      coverageItemId: z.number().describe("The coverage item ID to delete"),
    },
    async ({ coverageItemId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const coverageItem = await coverageItemsRepo.findById(coverageItemId);
      if (!coverageItem) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Coverage item with id ${coverageItemId} not found`,
            },
          ],
        };
      }

      await coverageItemsRepo.delete(coverageItemId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: coverageItemId }),
          },
        ],
      };
    },
  );
}
