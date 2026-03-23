/**
 * MCP Tools: Beneficiaries
 *
 * Tools for managing policy beneficiaries.
 * Beneficiaries are always scoped to a specific policy.
 * No FK restrict needed on delete — beneficiaries have no child references.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { beneficiariesRepo, policiesRepo, membersRepo } from "@/db/repositories";
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

      const items = await beneficiariesRepo.findByPolicyId(policyId);
      const result = await Promise.all(
        items.map(async (b) => {
          const member = b.memberId
            ? await membersRepo.findById(b.memberId)
            : undefined;
          return {
            id: b.id,
            policyId: b.policyId,
            memberId: b.memberId,
            memberName: member?.name,
            externalName: b.externalName,
            externalIdCard: b.externalIdCard,
            sharePercent: b.sharePercent,
            rankOrder: b.rankOrder,
          };
        }),
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // get-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "get-beneficiary",
    "Get detailed information about a beneficiary",
    {
      beneficiaryId: z.number().describe("The beneficiary ID to look up"),
    },
    async ({ beneficiaryId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const beneficiary = await beneficiariesRepo.findById(beneficiaryId);
      if (!beneficiary) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Beneficiary with id ${beneficiaryId} not found`,
            },
          ],
        };
      }

      const member = beneficiary.memberId
        ? await membersRepo.findById(beneficiary.memberId)
        : undefined;

      const result = {
        ...beneficiary,
        memberName: member?.name,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      // Validate identity constraint: memberId XOR externalName (exactly one required)
      if (args.memberId && args.externalName) {
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
      if (!args.memberId && !args.externalName) {
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

      // Validate member exists if memberId provided
      if (args.memberId) {
        const member = await membersRepo.findById(args.memberId);
        if (!member) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Member with id ${args.memberId} not found`,
              },
            ],
          };
        }
      }

      const beneficiary = await beneficiariesRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(beneficiary) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "update-beneficiary",
    "Update a beneficiary record. To switch identity type, pass the new identity and set the old one to null (e.g. memberId: 5, externalName: null).",
    {
      beneficiaryId: z.number().describe("The beneficiary ID to update"),
      sharePercent: z.number().optional().describe("Benefit share percentage"),
      rankOrder: z.number().optional().describe("Beneficiary rank order"),
      memberId: z.number().nullable().optional().describe("Family member ID (null to clear)"),
      externalName: z.string().nullable().optional().describe("External beneficiary name (null to clear)"),
      externalIdCard: z.string().nullable().optional().describe("External beneficiary ID card number (null to clear)"),
    },
    async ({ beneficiaryId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Validate beneficiary exists first (needed for identity constraint check)
      const existing = await beneficiariesRepo.findById(beneficiaryId);
      if (!existing) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Beneficiary with id ${beneficiaryId} not found`,
            },
          ],
        };
      }

      // Validate member exists if memberId provided
      if (data.memberId) {
        const member = await membersRepo.findById(data.memberId);
        if (!member) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Member with id ${data.memberId} not found`,
              },
            ],
          };
        }
      }

      // Compute effective identity after update to enforce XOR constraint
      const effectiveMemberId = data.memberId !== undefined ? data.memberId : existing.memberId;
      const effectiveExternalName = data.externalName !== undefined ? data.externalName : existing.externalName;
      if (effectiveMemberId && effectiveExternalName) {
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
      if (!effectiveMemberId && !effectiveExternalName) {
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

      const updated = await beneficiariesRepo.update(beneficiaryId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Beneficiary with id ${beneficiaryId} not found`,
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
  // delete-beneficiary
  // -------------------------------------------------------------------------
  server.tool(
    "delete-beneficiary",
    "Remove a beneficiary record (no FK restrictions)",
    {
      beneficiaryId: z.number().describe("The beneficiary ID to delete"),
    },
    async ({ beneficiaryId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const beneficiary = await beneficiariesRepo.findById(beneficiaryId);
      if (!beneficiary) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Beneficiary with id ${beneficiaryId} not found`,
            },
          ],
        };
      }

      await beneficiariesRepo.delete(beneficiaryId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: beneficiaryId }),
          },
        ],
      };
    },
  );
}
