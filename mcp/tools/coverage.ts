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
import { isEffectivelyActive, type PolicyDbStatus } from "@/db/types";
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
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      if (type === "member") {
        const member = await membersRepo.findById(id);
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

        const allMemberPolicies = await policiesRepo.findByInsuredMemberId(id);
        const policies = allMemberPolicies.filter((p) =>
          isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate),
        );

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
          const cat = byCategory[p.category];
          if (cat) {
            cat.count++;
            cat.premium += p.premium;
            cat.sumAssured += p.sumAssured;
          }
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
        const asset = await assetsRepo.findById(id);
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

        const allPolicies = await policiesRepo.findAll();
        const policies = allPolicies.filter(
          (p) => p.insuredAssetId === id && isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate),
        );

        const owner = asset.ownerId
          ? await membersRepo.findById(asset.ownerId)
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
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const lookAheadMonths = months ?? 12;
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() + lookAheadMonths);

      const allPolicies = await policiesRepo.findAll();
      const activePolicies = allPolicies.filter(
        (p) => isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate),
      );

      const upcoming = await Promise.all(
        activePolicies
          .filter((p) => {
            const dateStr = p.nextDueDate ?? p.expiryDate;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return date >= now && date <= cutoff;
          })
          .map(async (p) => {
            const applicant = await membersRepo.findById(p.applicantId);
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
          }),
      );

      upcoming.sort((a, b) => {
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
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const members = await membersRepo.findAll();
      const policies = await policiesRepo.findAll();
      const activePolicies = policies.filter(
        (p) => isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate),
      );

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
        const cat = byCategory[p.category];
        if (cat) {
          cat.count++;
          cat.premium += p.premium;
          cat.sumAssured += p.sumAssured;
        }
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
