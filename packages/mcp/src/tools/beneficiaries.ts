/**
 * MCP Tools: Beneficiaries
 *
 * Tools for managing policy beneficiaries.
 * Beneficiaries are always scoped to a specific policy.
 * The Worker API handles validation and enrichment.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerBeneficiaryTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-beneficiaries
  // -------------------------------------------------------------------------
  server.tool(
    "list-beneficiaries",
    "List beneficiaries for a specific policy",
    {
      policyId: z.number().describe("The policy ID to list beneficiaries for"),
    },
    async ({ policyId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const items = await apiGet(`/api/policies/${policyId}/beneficiaries`);
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
  // get-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "get-beneficiary",
    "Get detailed information about a beneficiary (via the policy's beneficiary list)",
    {
      policyId: z.number().describe("The policy ID the beneficiary belongs to"),
      beneficiaryId: z.number().describe("The beneficiary ID to look up"),
    },
    async ({ policyId, beneficiaryId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const items = await apiGet<Array<{ id: number }>>(`/api/policies/${policyId}/beneficiaries`);
        const beneficiary = items.find((b) => b.id === beneficiaryId);
        if (!beneficiary) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Beneficiary with id ${beneficiaryId} not found in policy ${policyId}`,
              },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(beneficiary) }],
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
  // create-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "create-beneficiary",
    "Add a beneficiary to a policy",
    {
      policyId: z.number().describe("The policy ID to add a beneficiary to"),
      sharePercent: z.number().describe("Benefit share percentage (e.g. 50 for 50%)"),
      rankOrder: z.number().describe("Beneficiary rank order (1 = primary)"),
      memberId: z.number().optional().describe("Family member ID (for internal beneficiary)"),
      externalName: z.string().optional().describe("External beneficiary name (if not a family member)"),
      externalIdCard: z.string().optional().describe("External beneficiary ID card number"),
    },
    async ({ policyId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Validate identity constraint locally for better error messages
      if (data.memberId && data.externalName) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Cannot set both memberId and externalName — use one or the other",
            },
          ],
        };
      }
      if (!data.memberId && !data.externalName) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Either memberId or externalName is required to identify the beneficiary",
            },
          ],
        };
      }

      try {
        // API expects an array of beneficiaries
        const result = await apiPost(`/api/policies/${policyId}/beneficiaries`, [stripUndefined(data)]);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
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
  // update-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "update-beneficiary",
    "Update a beneficiary record. To switch identity type, pass the new identity and set the old one to null (e.g. memberId: 5, externalName: null).",
    {
      policyId: z.number().describe("The policy ID the beneficiary belongs to"),
      beneficiaryId: z.number().describe("The beneficiary ID to update"),
      sharePercent: z.number().optional().describe("Benefit share percentage"),
      rankOrder: z.number().optional().describe("Beneficiary rank order"),
      memberId: z.number().nullable().optional().describe("Family member ID (null to clear)"),
      externalName: z.string().nullable().optional().describe("External beneficiary name (null to clear)"),
      externalIdCard: z.string().nullable().optional().describe("External beneficiary ID card number (null to clear)"),
    },
    async ({ policyId, beneficiaryId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        // Replace all beneficiaries: fetch current list, modify the target, and POST the full set
        const items = await apiGet<Array<Record<string, unknown>>>(`/api/policies/${policyId}/beneficiaries`);
        const idx = items.findIndex((b) => b.id === beneficiaryId);
        if (idx === -1) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Beneficiary with id ${beneficiaryId} not found in policy ${policyId}`,
              },
            ],
          };
        }

        // Merge updates into the existing record
        const updated = { ...items[idx], ...stripUndefined(data) };
        // Handle explicit nulls
        if (data.memberId === null) updated.memberId = null;
        if (data.externalName === null) updated.externalName = null;
        if (data.externalIdCard === null) updated.externalIdCard = null;

        items[idx] = updated;

        const result = await apiPost(`/api/policies/${policyId}/beneficiaries`, items);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
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
  // delete-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "delete-beneficiary",
    "Remove a beneficiary record (no FK restrictions)",
    {
      policyId: z.number().describe("The policy ID the beneficiary belongs to"),
      beneficiaryId: z.number().describe("The beneficiary ID to delete"),
    },
    async ({ policyId, beneficiaryId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        // Fetch current list, remove the target, and POST the remaining set
        const items = await apiGet<Array<{ id: number }>>(`/api/policies/${policyId}/beneficiaries`);
        const filtered = items.filter((b) => b.id !== beneficiaryId);
        if (filtered.length === items.length) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Beneficiary with id ${beneficiaryId} not found in policy ${policyId}`,
              },
            ],
          };
        }

        await apiPost(`/api/policies/${policyId}/beneficiaries`, filtered);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: beneficiaryId }),
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
