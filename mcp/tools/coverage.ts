/**
 * MCP Tools: Coverage & Analytics
 *
 * Tools for coverage analysis, renewal overview, and dashboard summary.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  membersRepo,
  assetsRepo,
  policiesRepo,
} from "@/db/repositories";
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
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      if (type === "member") {
        const member = membersRepo.findById(id);
        if (!member) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Member with id ${id} not found`,
              },
            ],
          };
        }

        const policies = policiesRepo
          .findByInsuredMemberId(id)
          .filter((p) => p.status === "Active");

        const totalPremium = policies.reduce((sum, p) => sum + p.premium, 0);
        const totalSumAssured = policies.reduce(
          (sum, p) => sum + p.sumAssured,
          0,
        );

        // Group by category
        const byCategory: Record<
          string,
          { count: number; premium: number; sumAssured: number }
        > = {};
        for (const p of policies) {
          if (!byCategory[p.category]) {
            byCategory[p.category] = { count: 0, premium: 0, sumAssured: 0 };
          }
          const cat = byCategory[p.category]!;
          cat.count++;
          cat.premium += p.premium;
          cat.sumAssured += p.sumAssured;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                name: member.name,
                relation: member.relation,
                totalPremium,
                totalSumAssured,
                policyCount: policies.length,
                byCategory,
                policies: policies.map((p) => ({
                  id: p.id,
                  productName: p.productName,
                  category: p.category,
                  premium: p.premium,
                  sumAssured: p.sumAssured,
                })),
              }),
            },
          ],
        };
      } else {
        // asset
        const asset = assetsRepo.findById(id);
        if (!asset) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Asset with id ${id} not found`,
              },
            ],
          };
        }

        const allPolicies = policiesRepo.findAll();
        const policies = allPolicies.filter(
          (p) => p.insuredAssetId === id && p.status === "Active",
        );

        const owner = asset.ownerId
          ? membersRepo.findById(asset.ownerId)
          : undefined;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                name: asset.name,
                type: asset.type,
                identifier: asset.identifier,
                ownerName: owner?.name,
                policies: policies.map((p) => ({
                  id: p.id,
                  productName: p.productName,
                  category: p.category,
                  premium: p.premium,
                  sumAssured: p.sumAssured,
                })),
              }),
            },
          ],
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
    async ({ months }) => {
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const lookAheadMonths = months ?? 12;
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() + lookAheadMonths);

      const allPolicies = policiesRepo.findAll();
      const activePolicies = allPolicies.filter(
        (p) => p.status === "Active",
      );

      const upcoming = activePolicies
        .filter((p) => {
          const dateStr = p.nextDueDate ?? p.expiryDate;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date >= now && date <= cutoff;
        })
        .map((p) => {
          const applicant = membersRepo.findById(p.applicantId);
          return {
            id: p.id,
            productName: p.productName,
            policyNumber: p.policyNumber,
            insurerName: p.insurerName,
            premium: p.premium,
            nextDueDate: p.nextDueDate,
            expiryDate: p.expiryDate,
            applicantName: applicant?.name,
          };
        })
        .sort((a, b) => {
          const dateA = a.nextDueDate ?? a.expiryDate ?? "";
          const dateB = b.nextDueDate ?? b.expiryDate ?? "";
          return dateA.localeCompare(dateB);
        });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              lookAheadMonths,
              total: upcoming.length,
              policies: upcoming,
            }),
          },
        ],
      };
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
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const members = membersRepo.findAll();
      const policies = policiesRepo.findAll();
      const activePolicies = policies.filter((p) => p.status === "Active");

      const totalPremium = activePolicies.reduce(
        (sum, p) => sum + p.premium,
        0,
      );
      const totalSumAssured = activePolicies.reduce(
        (sum, p) => sum + p.sumAssured,
        0,
      );

      // Group by category
      const byCategory: Record<
        string,
        { count: number; premium: number; sumAssured: number }
      > = {};
      for (const p of activePolicies) {
        if (!byCategory[p.category]) {
          byCategory[p.category] = { count: 0, premium: 0, sumAssured: 0 };
        }
        const cat = byCategory[p.category]!;
        cat.count++;
        cat.premium += p.premium;
        cat.sumAssured += p.sumAssured;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              memberCount: members.length,
              policyCount: policies.length,
              activePolicyCount: activePolicies.length,
              totalPremium,
              totalSumAssured,
              byCategory,
            }),
          },
        ],
      };
    },
  );
}
