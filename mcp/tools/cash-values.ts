/**
 * MCP Tools: Cash Values
 *
 * Tools for managing policy cash value records.
 * Cash values are always scoped to a specific policy.
 * No FK restrict needed on delete — cash values have no child references.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cashValuesRepo, policiesRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerCashValueTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-cash-values
  // -------------------------------------------------------------------------
  server.tool(
    "list-cash-values",
    "List cash value records for a specific policy",
    {
      policyId: z.number().describe("The policy ID to list cash values for"),
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

      const items = await cashValuesRepo.findByPolicyId(policyId);
      const result = items.map((cv) => ({
        id: cv.id,
        policyId: cv.policyId,
        policyYear: cv.policyYear,
        value: cv.value,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // create-cash-value
  // -------------------------------------------------------------------------
  server.tool(
    "create-cash-value",
    "Add a cash value record to a policy",
    {
      policyId: z.number().describe("The policy ID to add a cash value to"),
      policyYear: z.number().describe("Policy year (e.g. 1, 2, 3...)"),
      value: z.number().describe("Cash value amount at that policy year"),
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

      const cashValue = await cashValuesRepo.create(args);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(cashValue) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-cash-value
  // -------------------------------------------------------------------------
  server.tool(
    "update-cash-value",
    "Update a cash value record",
    {
      cashValueId: z.number().describe("The cash value ID to update"),
      policyYear: z.number().optional().describe("Policy year"),
      value: z.number().optional().describe("Cash value amount"),
    },
    async ({ cashValueId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const updated = await cashValuesRepo.update(cashValueId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Cash value with id ${cashValueId} not found`,
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
  // delete-cash-value
  // -------------------------------------------------------------------------
  server.tool(
    "delete-cash-value",
    "Remove a cash value record (no FK restrictions)",
    {
      cashValueId: z.number().describe("The cash value ID to delete"),
    },
    async ({ cashValueId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const cashValue = await cashValuesRepo.findById(cashValueId);
      if (!cashValue) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Cash value with id ${cashValueId} not found`,
            },
          ],
        };
      }

      await cashValuesRepo.delete(cashValueId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: cashValueId }),
          },
        ],
      };
    },
  );
}
