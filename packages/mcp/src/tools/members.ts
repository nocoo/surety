/**
 * MCP Tools: Members
 *
 * Tools for querying and managing family member information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
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

      try {
        const members = await apiGet("/api/members");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(members) }],
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
    "get-member",
    "Get detailed information about a specific family member, including their policies",
    { memberId: z.number().describe("The member ID to look up") },
    async ({ memberId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const member = await apiGet(`/api/members/${memberId}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(member) }],
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

      try {
        const member = await apiPost("/api/members", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(member) }],
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

      try {
        const updated = await apiPut(`/api/members/${memberId}`, stripUndefined(data));
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

      try {
        await apiDelete(`/api/members/${memberId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: memberId }),
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
