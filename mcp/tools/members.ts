/**
 * MCP Tools: Members
 *
 * Tools for querying family member information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { membersRepo, policiesRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

export function registerMemberTools(server: McpServer): void {
  server.tool(
    "list-members",
    "List all family members with their basic information",
    {},
    async () => {
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const members = membersRepo.findAll();
      const result = members.map((m) => ({
        id: m.id,
        name: m.name,
        relation: m.relation,
        gender: m.gender,
        birthDate: m.birthDate,
        phone: m.phone,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "get-member",
    "Get detailed information about a specific family member, including their policies",
    { memberId: z.number().describe("The member ID to look up") },
    async ({ memberId }) => {
      const error = checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const member = membersRepo.findById(memberId);
      if (!member) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Member with id ${memberId} not found`,
            },
          ],
        };
      }

      // Find policies where this member is insured
      const insuredPolicies = policiesRepo.findByInsuredMemberId(memberId);
      // Find policies where this member is applicant
      const applicantPolicies = policiesRepo.findByApplicantId(memberId);

      // Merge and deduplicate
      const allPolicyIds = new Set<number>();
      const allPolicies = [];
      for (const p of [...insuredPolicies, ...applicantPolicies]) {
        if (!allPolicyIds.has(p.id)) {
          allPolicyIds.add(p.id);
          allPolicies.push({
            id: p.id,
            productName: p.productName,
            policyNumber: p.policyNumber,
            category: p.category,
            status: p.status,
            premium: p.premium,
            sumAssured: p.sumAssured,
            role: insuredPolicies.some((ip) => ip.id === p.id)
              ? "insured"
              : "applicant",
          });
        }
      }

      const result = {
        id: member.id,
        name: member.name,
        relation: member.relation,
        gender: member.gender,
        birthDate: member.birthDate,
        phone: member.phone,
        policies: allPolicies,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
