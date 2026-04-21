/**
 * MCP Tools: Medical Visits
 *
 * Tools for managing medical visit records.
 * The Worker API handles FK validation and enrichment.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

const VISIT_TYPES = [
  "儿保",
  "门诊",
  "急诊",
  "体检",
  "复查",
  "预约",
] as const;

export function registerMedicalVisitTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-medical-visits
  // -------------------------------------------------------------------------
  server.tool(
    "list-medical-visits",
    "List medical visits with member, hospital, and doctor names",
    {
      memberId: z.number().optional().describe("Filter by member ID"),
      hospitalId: z.number().optional().describe("Filter by hospital ID"),
      doctorId: z.number().optional().describe("Filter by doctor ID"),
    },
    async ({ memberId, hospitalId, doctorId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const params = new URLSearchParams();
        if (memberId !== undefined) params.set("memberId", String(memberId));
        if (hospitalId !== undefined) params.set("hospitalId", String(hospitalId));
        if (doctorId !== undefined) params.set("doctorId", String(doctorId));
        const qs = params.toString();
        const path = qs ? `/api/medical-visits?${qs}` : "/api/medical-visits";
        const visits = await apiGet(path);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(visits) }],
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
  // get-medical-visit
  // -------------------------------------------------------------------------
  server.tool(
    "get-medical-visit",
    "Get detailed information about a medical visit",
    { visitId: z.number().describe("The medical visit ID to look up") },
    async ({ visitId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const visit = await apiGet(`/api/medical-visits/${visitId}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(visit) }],
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
  // create-medical-visit
  // -------------------------------------------------------------------------
  server.tool(
    "create-medical-visit",
    "Create a new medical visit record",
    {
      memberId: z.number().describe("Member ID"),
      hospitalId: z.number().describe("Hospital ID"),
      doctorId: z.number().optional().describe("Doctor ID (optional)"),
      visitDate: z.string().describe("Visit date (YYYY-MM-DD)"),
      visitTimeStart: z.string().optional().describe("Start time (HH:mm)"),
      visitTimeEnd: z.string().optional().describe("End time (HH:mm)"),
      visitType: z.enum(VISIT_TYPES).describe("Visit type"),
      visitReason: z.string().min(1).describe("Reason for visit (required, non-empty)"),
      department: z.string().optional().describe("Department"),
      symptoms: z.string().optional().describe("Symptoms (JSON array string)"),
      diagnosis: z.string().optional().describe("Diagnosis"),
      treatment: z.string().optional().describe("Treatment/prescription"),
      totalCost: z.number().optional().describe("Total cost"),
      insurancePaid: z.number().optional().describe("Insurance paid amount"),
      selfPaid: z.number().optional().describe("Self-paid amount"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const visit = await apiPost("/api/medical-visits", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(visit) }],
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
  // update-medical-visit
  // -------------------------------------------------------------------------
  server.tool(
    "update-medical-visit",
    "Update a medical visit record (pass null to clear optional fields)",
    {
      visitId: z.number().describe("The medical visit ID to update"),
      memberId: z.number().optional().describe("Member ID"),
      hospitalId: z.number().optional().describe("Hospital ID"),
      doctorId: z.number().nullable().optional().describe("Doctor ID (null to clear)"),
      visitDate: z.string().optional().describe("Visit date (YYYY-MM-DD)"),
      visitTimeStart: z.string().nullable().optional().describe("Start time (HH:mm, null to clear)"),
      visitTimeEnd: z.string().nullable().optional().describe("End time (HH:mm, null to clear)"),
      visitType: z.enum(VISIT_TYPES).optional().describe("Visit type"),
      visitReason: z.string().optional().describe("Reason for visit"),
      department: z.string().nullable().optional().describe("Department (null to clear)"),
      symptoms: z.string().nullable().optional().describe("Symptoms (JSON array string, null to clear)"),
      diagnosis: z.string().nullable().optional().describe("Diagnosis (null to clear)"),
      treatment: z.string().nullable().optional().describe("Treatment/prescription (null to clear)"),
      totalCost: z.number().nullable().optional().describe("Total cost (null to clear)"),
      insurancePaid: z.number().nullable().optional().describe("Insurance paid amount (null to clear)"),
      selfPaid: z.number().nullable().optional().describe("Self-paid amount (null to clear)"),
      notes: z.string().nullable().optional().describe("Additional notes (null to clear)"),
    },
    async ({ visitId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(`/api/medical-visits/${visitId}`, stripUndefined(data));
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
  // delete-medical-visit
  // -------------------------------------------------------------------------
  server.tool(
    "delete-medical-visit",
    "Delete a medical visit record",
    {
      visitId: z.number().describe("The medical visit ID to delete"),
    },
    async ({ visitId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/medical-visits/${visitId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: visitId }),
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
