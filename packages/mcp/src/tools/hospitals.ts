/**
 * MCP Tools: Hospitals
 *
 * Tools for managing hospitals.
 * The Worker API handles FK restriction on delete.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

const HOSPITAL_LEVELS = [
  "三甲",
  "三乙",
  "二甲",
  "二乙",
  "一级",
  "社区",
  "诊所",
  "未评级",
] as const;

export function registerHospitalTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-hospitals
  // -------------------------------------------------------------------------
  server.tool(
    "list-hospitals",
    "List all hospitals with doctor counts",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const hospitals = await apiGet("/api/hospitals");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(hospitals) }],
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
  // get-hospital
  // -------------------------------------------------------------------------
  server.tool(
    "get-hospital",
    "Get detailed information about a hospital",
    { hospitalId: z.number().describe("The hospital ID to look up") },
    async ({ hospitalId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const hospital = await apiGet(`/api/hospitals/${hospitalId}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(hospital) }],
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
  // create-hospital
  // -------------------------------------------------------------------------
  server.tool(
    "create-hospital",
    "Create a new hospital",
    {
      name: z.string().min(1).describe("Hospital name (required, non-empty)"),
      level: z
        .enum(HOSPITAL_LEVELS)
        .optional()
        .describe("Hospital level (三甲/三乙/二甲/二乙/一级/社区/诊所/未评级)"),
      isPublic: z.boolean().optional().describe("Whether public hospital (default true)"),
      address: z.string().optional().describe("Hospital address"),
      phone: z.string().optional().describe("Contact phone"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const hospital = await apiPost("/api/hospitals", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(hospital) }],
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
  // update-hospital
  // -------------------------------------------------------------------------
  server.tool(
    "update-hospital",
    "Update a hospital (pass null to clear optional fields)",
    {
      hospitalId: z.number().describe("The hospital ID to update"),
      name: z.string().optional().describe("Hospital name"),
      level: z
        .enum(HOSPITAL_LEVELS)
        .nullable()
        .optional()
        .describe("Hospital level (null to clear)"),
      isPublic: z.boolean().optional().describe("Whether public hospital"),
      address: z.string().nullable().optional().describe("Hospital address (null to clear)"),
      phone: z.string().nullable().optional().describe("Contact phone (null to clear)"),
      notes: z.string().nullable().optional().describe("Additional notes (null to clear)"),
    },
    async ({ hospitalId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(`/api/hospitals/${hospitalId}`, stripUndefined(data));
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
  // delete-hospital
  // -------------------------------------------------------------------------
  server.tool(
    "delete-hospital",
    "Delete a hospital (fails if referenced by doctors or medical visits)",
    {
      hospitalId: z.number().describe("The hospital ID to delete"),
    },
    async ({ hospitalId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/hospitals/${hospitalId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: hospitalId }),
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
