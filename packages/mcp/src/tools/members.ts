/**
 * MCP Tools: Members
 *
 * Tools for querying and managing family member information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  membersRepo,
  policiesRepo,
  beneficiariesRepo,
  assetsRepo,
  medicalVisitsRepo,
} from "@surety/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerMemberTools(server: McpServer): void {
  server.tool(
    "list-members",
    "List all family members with their basic information",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const members = await membersRepo.findAll();
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
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const member = await membersRepo.findById(memberId);
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
      const insuredPolicies = await policiesRepo.findByInsuredMemberId(memberId);
      // Find policies where this member is applicant
      const applicantPolicies = await policiesRepo.findByApplicantId(memberId);

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

  // -------------------------------------------------------------------------
  // create-member
  // -------------------------------------------------------------------------
  server.tool(
    "create-member",
    "Create a new family member",
    {
      name: z.string().describe("Member name"),
      relation: z
        .enum(["Self", "Spouse", "Child", "Parent", "Pet"])
        .describe("Relation to the primary insured"),
      gender: z.enum(["M", "F"]).optional().describe("Gender"),
      birthDate: z.string().optional().describe("Birth date (YYYY-MM-DD)"),
      idCard: z.string().optional().describe("ID card number"),
      idType: z.string().optional().describe("ID type (身份证/户口本/护照)"),
      idExpiry: z
        .string()
        .optional()
        .describe("ID expiry range (e.g. 2021-10-05|2041-10-05)"),
      phone: z.string().optional().describe("Phone number"),
      hasSocialInsurance: z
        .boolean()
        .optional()
        .describe("Whether the member has social insurance"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const member = await membersRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(member) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-member
  // -------------------------------------------------------------------------
  server.tool(
    "update-member",
    "Update an existing family member",
    {
      memberId: z.number().describe("The member ID to update"),
      name: z.string().optional().describe("Member name"),
      relation: z
        .enum(["Self", "Spouse", "Child", "Parent", "Pet"])
        .optional()
        .describe("Relation to the primary insured"),
      gender: z.enum(["M", "F"]).optional().describe("Gender"),
      birthDate: z.string().optional().describe("Birth date (YYYY-MM-DD)"),
      idCard: z.string().optional().describe("ID card number"),
      idType: z.string().optional().describe("ID type (身份证/户口本/护照)"),
      idExpiry: z
        .string()
        .optional()
        .describe("ID expiry range (e.g. 2021-10-05|2041-10-05)"),
      phone: z.string().optional().describe("Phone number"),
      hasSocialInsurance: z
        .boolean()
        .optional()
        .describe("Whether the member has social insurance"),
    },
    async ({ memberId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const updated = await membersRepo.update(memberId, stripUndefined(data));
      if (!updated) {
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

      return {
        content: [{ type: "text" as const, text: JSON.stringify(updated) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // delete-member
  // -------------------------------------------------------------------------
  server.tool(
    "delete-member",
    "Delete a family member (fails if referenced by policies, beneficiaries, assets, or medical visits)",
    {
      memberId: z.number().describe("The member ID to delete"),
    },
    async ({ memberId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Check if member exists
      const member = await membersRepo.findById(memberId);
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

      // Check referencing policies
      const asApplicant = await policiesRepo.findByApplicantId(memberId);
      const asInsured = await policiesRepo.findByInsuredMemberId(memberId);

      // Check referencing beneficiaries
      const allBeneficiaries = await beneficiariesRepo.findAll();
      const asBeneficiary = allBeneficiaries.filter(
        (b) => b.memberId === memberId,
      );

      // Check referencing assets (assets.ownerId → members.id)
      const ownedAssets = await assetsRepo.findByOwnerId(memberId);

      // Check referencing medical visits
      const medicalVisits = await medicalVisitsRepo.findByMemberId(memberId);

      if (
        asApplicant.length ||
        asInsured.length ||
        asBeneficiary.length ||
        ownedAssets.length ||
        medicalVisits.length
      ) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Cannot delete member: still referenced",
                asApplicant: asApplicant.map((p) => ({
                  id: p.id,
                  policyNumber: p.policyNumber,
                })),
                asInsured: asInsured.map((p) => ({
                  id: p.id,
                  policyNumber: p.policyNumber,
                })),
                asBeneficiary: asBeneficiary.map((b) => ({
                  id: b.id,
                  policyId: b.policyId,
                })),
                ownedAssets: ownedAssets.map((a) => ({
                  id: a.id,
                  name: a.name,
                })),
                medicalVisits: medicalVisits.slice(0, 5).map((v) => ({
                  id: v.id,
                  visitDate: v.visitDate,
                })),
                medicalVisitCount: medicalVisits.length,
              }),
            },
          ],
        };
      }

      await membersRepo.delete(memberId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: memberId }),
          },
        ],
      };
    },
  );
}
