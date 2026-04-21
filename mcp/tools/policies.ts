/**
 * MCP Tools: Policies
 *
 * Tools for querying and managing insurance policy information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  policiesRepo,
  membersRepo,
  assetsRepo,
  beneficiariesRepo,
  insurersRepo,
  paymentsRepo,
  cashValuesRepo,
  coverageItemsRepo,
} from "@surety/db/repositories";
import { createBatchExecutor } from "@surety/db";
import { deriveDisplayStatus, type PolicyDbStatus } from "@surety/db/types";
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

      const policies = await policiesRepo.findAll();

      // Derive display status for each policy
      const withDisplayStatus = policies.map((p) => ({
        ...p,
        displayStatus: deriveDisplayStatus(p.status as PolicyDbStatus, p.expiryDate),
      }));

      let filtered = withDisplayStatus;

      if (status) {
        filtered = filtered.filter((p) => p.displayStatus === status);
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

      // Enrich with member/asset names
      const result = await Promise.all(
        filtered.map(async (p) => {
          const applicant = await membersRepo.findById(p.applicantId);
          const insuredMember = p.insuredMemberId
            ? await membersRepo.findById(p.insuredMemberId)
            : undefined;
          const insuredAsset = p.insuredAssetId
            ? await assetsRepo.findById(p.insuredAssetId)
            : undefined;

          return {
            id: p.id,
            productName: p.productName,
            policyNumber: p.policyNumber,
            category: p.category,
            subCategory: p.subCategory,
            insurerName: p.insurerName,
            status: p.displayStatus,
            premium: p.premium,
            sumAssured: p.sumAssured,
            effectiveDate: p.effectiveDate,
            expiryDate: p.expiryDate,
            applicantName: applicant?.name,
            insuredName: insuredMember?.name,
            insuredAssetName: insuredAsset?.name,
          };
        }),
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get-policy",
    "Get full details of a specific insurance policy including beneficiaries",
    { policyId: z.number().describe("The policy ID to look up") },
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

      const applicant = await membersRepo.findById(policy.applicantId);
      const insuredMember = policy.insuredMemberId
        ? await membersRepo.findById(policy.insuredMemberId)
        : undefined;
      const insuredAsset = policy.insuredAssetId
        ? await assetsRepo.findById(policy.insuredAssetId)
        : undefined;

      // Get beneficiaries with member names
      const beneficiaryRecords = await beneficiariesRepo.findByPolicyId(policyId);
      const beneficiaries = await Promise.all(
        beneficiaryRecords.map(async (b) => {
          const member = b.memberId
            ? await membersRepo.findById(b.memberId)
            : undefined;
          return {
            name: member?.name ?? b.externalName,
            sharePercent: b.sharePercent,
            rankOrder: b.rankOrder,
          };
        }),
      );

      const result = {
        id: policy.id,
        productName: policy.productName,
        policyNumber: policy.policyNumber,
        category: policy.category,
        subCategory: policy.subCategory,
        insurerName: policy.insurerName,
        insuredType: policy.insuredType,
        status: deriveDisplayStatus(policy.status as PolicyDbStatus, policy.expiryDate),
        premium: policy.premium,
        sumAssured: policy.sumAssured,
        paymentFrequency: policy.paymentFrequency,
        paymentYears: policy.paymentYears,
        effectiveDate: policy.effectiveDate,
        expiryDate: policy.expiryDate,
        nextDueDate: policy.nextDueDate,
        notes: policy.notes,
        applicantName: applicant?.name,
        insuredName: insuredMember?.name,
        insuredAssetName: insuredAsset?.name,
        beneficiaries,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      // Validate insuredType discriminated constraint
      if (args.insuredType === "Member") {
        if (!args.insuredMemberId) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "insuredMemberId is required when insuredType is Member",
              },
            ],
          };
        }
      } else {
        if (!args.insuredAssetId) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "insuredAssetId is required when insuredType is Asset",
              },
            ],
          };
        }
      }

      // Auto-create insurer if needed
      const insurer = await insurersRepo.findOrCreate(args.insurerName);

      const { insuredMemberId, insuredAssetId, ...rest } = args;
      const createData = stripUndefined({
        ...rest,
        insurerId: insurer.id,
        insuredMemberId:
          args.insuredType === "Member" ? insuredMemberId : undefined,
        insuredAssetId:
          args.insuredType === "Asset" ? insuredAssetId : undefined,
        status: args.status ?? "Active",
      });

      const policy = await policiesRepo.create(createData);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(policy) }],
      };
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

      const existing = await policiesRepo.findById(policyId);
      if (!existing) {
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

      const updateData: Record<string, unknown> = { ...args };

      // Handle insuredType switch: validate FK and clear opposing side
      if (args.insuredType) {
        if (args.insuredType === "Member") {
          if (!args.insuredMemberId) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "insuredMemberId is required when insuredType is Member",
                },
              ],
            };
          }
          updateData.insuredAssetId = null;
        } else {
          if (!args.insuredAssetId) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: "insuredAssetId is required when insuredType is Asset",
                },
              ],
            };
          }
          updateData.insuredMemberId = null;
        }
      }

      // Sync insurerId when insurerName changes
      if (args.insurerName) {
        const insurer = await insurersRepo.findOrCreate(args.insurerName);
        updateData.insurerId = insurer.id;
      }

      const updated = await policiesRepo.update(
        policyId,
        stripUndefined(updateData),
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(updated) }],
      };
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

      // Atomic cascade delete via D1 batch API
      const batchExecutor = createBatchExecutor();
      if (batchExecutor) {
        await batchExecutor([
          {
            sql: "DELETE FROM beneficiaries WHERE policy_id = ?",
            params: [policyId],
          },
          {
            sql: "DELETE FROM payments WHERE policy_id = ?",
            params: [policyId],
          },
          {
            sql: "DELETE FROM cash_values WHERE policy_id = ?",
            params: [policyId],
          },
          {
            sql: "DELETE FROM coverage_items WHERE policy_id = ?",
            params: [policyId],
          },
          { sql: "DELETE FROM policies WHERE id = ?", params: [policyId] },
        ]);
      } else {
        // Test env (bun:sqlite): sequential delete via repos
        await beneficiariesRepo.deleteByPolicyId(policyId);
        await paymentsRepo.deleteByPolicyId(policyId);
        await cashValuesRepo.deleteByPolicyId(policyId);
        await coverageItemsRepo.deleteByPolicyId(policyId);
        await policiesRepo.delete(policyId);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: policyId }),
          },
        ],
      };
    },
  );
}
