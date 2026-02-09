/**
 * MCP Tools: Policies
 *
 * Tools for querying insurance policy information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  policiesRepo,
  membersRepo,
  assetsRepo,
  beneficiariesRepo,
} from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

export function registerPolicyTools(server: McpServer): void {
  server.tool(
    "list-policies",
    "List all insurance policies with optional filters for status, category, or member",
    {
      status: z
        .enum(["Active", "Lapsed", "Surrendered", "Claimed"])
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
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      let policies = policiesRepo.findAll();

      if (status) {
        policies = policies.filter((p) => p.status === status);
      }
      if (category) {
        policies = policies.filter((p) => p.category === category);
      }
      if (memberId) {
        policies = policies.filter(
          (p) =>
            p.insuredMemberId === memberId || p.applicantId === memberId,
        );
      }

      // Enrich with member/asset names
      const result = policies.map((p) => {
        const applicant = membersRepo.findById(p.applicantId);
        const insuredMember = p.insuredMemberId
          ? membersRepo.findById(p.insuredMemberId)
          : undefined;
        const insuredAsset = p.insuredAssetId
          ? assetsRepo.findById(p.insuredAssetId)
          : undefined;

        return {
          id: p.id,
          productName: p.productName,
          policyNumber: p.policyNumber,
          category: p.category,
          subCategory: p.subCategory,
          insurerName: p.insurerName,
          status: p.status,
          premium: p.premium,
          sumAssured: p.sumAssured,
          effectiveDate: p.effectiveDate,
          expiryDate: p.expiryDate,
          applicantName: applicant?.name,
          insuredName: insuredMember?.name,
          insuredAssetName: insuredAsset?.name,
        };
      });

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
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const policy = policiesRepo.findById(policyId);
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

      const applicant = membersRepo.findById(policy.applicantId);
      const insuredMember = policy.insuredMemberId
        ? membersRepo.findById(policy.insuredMemberId)
        : undefined;
      const insuredAsset = policy.insuredAssetId
        ? assetsRepo.findById(policy.insuredAssetId)
        : undefined;

      // Get beneficiaries with member names
      const beneficiaryRecords = beneficiariesRepo.findByPolicyId(policyId);
      const beneficiaries = beneficiaryRecords.map((b) => {
        const member = b.memberId
          ? membersRepo.findById(b.memberId)
          : undefined;
        return {
          name: member?.name ?? b.externalName,
          sharePercent: b.sharePercent,
          rankOrder: b.rankOrder,
        };
      });

      const result = {
        id: policy.id,
        productName: policy.productName,
        policyNumber: policy.policyNumber,
        category: policy.category,
        subCategory: policy.subCategory,
        insurerName: policy.insurerName,
        insuredType: policy.insuredType,
        status: policy.status,
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
}
