/**
 * MCP Tools: Policies
 *
 * Tools for querying and managing insurance policy information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

const policyCategories = [
  "Life",
  "CriticalIllness",
  "Medical",
  "Accident",
  "Annuity",
  "Property",
] as const;

const paymentFrequencies = ["Single", "Monthly", "Yearly"] as const;
const policyStatuses = ["Active", "Lapsed", "Surrendered", "Claimed"] as const;

export function registerPolicyTools(server: McpServer): void {
  server.tool(
    "list-policies",
    "List all insurance policies with optional filters for status, category, or member",
    {
      status: z
        .enum(["Active", "Expired", "Lapsed", "Surrendered", "Claimed"])
        .optional()
        .describe("Filter by policy status"),
      category: z
        .enum([
          "Life",
          "CriticalIllness",
          "Medical",
          "Accident",
          "Annuity",
          "Property",
        ])
        .optional()
        .describe("Filter by policy category"),
      memberId: z
        .number()
        .optional()
        .describe("Filter by insured member ID"),
    },
    async ({ status, category, memberId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        // The API returns enriched policies with displayStatus, applicantName, etc.
        const policies = await apiGet<Record<string, unknown>[]>("/api/policies");

        let filtered = policies;
        if (status) {
          filtered = filtered.filter((p) => p.status === status);
        }
        if (category) {
          filtered = filtered.filter((p) => p.category === category);
        }
        if (memberId) {
          filtered = filtered.filter(
            (p) =>
              p.insuredMemberId === memberId || p.applicantId === memberId,
          );
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(filtered) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  server.tool(
    "get-policy",
    "Get full details of a specific insurance policy including beneficiaries",
    { policyId: z.number().describe("The policy ID to look up") },
    async ({ policyId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const policy = await apiGet(`/api/policies/${policyId}`);
        // Also fetch beneficiaries for this policy
        const beneficiaries = await apiGet(`/api/policies/${policyId}/beneficiaries`);
        const result = { ...policy as Record<string, unknown>, beneficiaries };
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
  // create-policy
  // -------------------------------------------------------------------------
  server.tool(
    "create-policy",
    "Create a new insurance policy. insuredType determines whether insuredMemberId or insuredAssetId is required.",
    {
      applicantId: z.number().describe("The member ID of the policy applicant"),
      insuredType: z
        .enum(["Member", "Asset"])
        .describe("Whether the insured is a Member or Asset"),
      insuredMemberId: z
        .number()
        .optional()
        .describe("Required when insuredType is Member"),
      insuredAssetId: z
        .number()
        .optional()
        .describe("Required when insuredType is Asset"),
      category: z.enum(policyCategories).describe("Policy category"),
      subCategory: z.string().optional().describe("Sub-category"),
      insurerName: z
        .string()
        .describe("Insurance company name (auto-creates insurer if needed)"),
      productName: z.string().describe("Product name"),
      policyNumber: z.string().describe("Unique policy number"),
      channel: z.string().optional().describe("Purchase channel"),
      sumAssured: z.number().describe("Sum assured amount"),
      premium: z.number().describe("Premium amount"),
      paymentFrequency: z
        .enum(paymentFrequencies)
        .describe("Payment frequency"),
      paymentYears: z.number().optional().describe("Total payment years"),
      effectiveDate: z.string().describe("Effective date (YYYY-MM-DD)"),
      expiryDate: z.string().optional().describe("Expiry date (YYYY-MM-DD)"),
      status: z.enum(policyStatuses).optional().describe("Policy status"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const policy = await apiPost("/api/policies", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(policy) }],
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
  // update-policy
  // -------------------------------------------------------------------------
  server.tool(
    "update-policy",
    "Update an existing insurance policy. When changing insuredType, the opposing FK is automatically cleared.",
    {
      policyId: z.number().describe("The policy ID to update"),
      applicantId: z.number().optional().describe("Applicant member ID"),
      insuredType: z
        .enum(["Member", "Asset"])
        .optional()
        .describe("Insured type"),
      insuredMemberId: z
        .number()
        .optional()
        .describe("Required when insuredType changes to Member"),
      insuredAssetId: z
        .number()
        .optional()
        .describe("Required when insuredType changes to Asset"),
      category: z.enum(policyCategories).optional().describe("Policy category"),
      subCategory: z.string().optional().describe("Sub-category"),
      insurerName: z
        .string()
        .optional()
        .describe("Insurance company name (syncs insurerId)"),
      productName: z.string().optional().describe("Product name"),
      policyNumber: z.string().optional().describe("Unique policy number"),
      channel: z.string().optional().describe("Purchase channel"),
      sumAssured: z.number().optional().describe("Sum assured amount"),
      premium: z.number().optional().describe("Premium amount"),
      paymentFrequency: z
        .enum(paymentFrequencies)
        .optional()
        .describe("Payment frequency"),
      paymentYears: z.number().optional().describe("Total payment years"),
      effectiveDate: z
        .string()
        .optional()
        .describe("Effective date (YYYY-MM-DD)"),
      expiryDate: z
        .string()
        .optional()
        .describe("Expiry date (YYYY-MM-DD)"),
      status: z.enum(policyStatuses).optional().describe("Policy status"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async ({ policyId, ...args }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(`/api/policies/${policyId}`, stripUndefined(args));
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
  // delete-policy
  // -------------------------------------------------------------------------
  server.tool(
    "delete-policy",
    "Delete a policy and all related records (beneficiaries, payments, cash values, coverage items) atomically",
    {
      policyId: z.number().describe("The policy ID to delete"),
    },
    async ({ policyId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/policies/${policyId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: policyId }),
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
