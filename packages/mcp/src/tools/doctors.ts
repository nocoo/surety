/**
 * MCP Tools: Doctors
 *
 * Tools for managing doctors.
 * The Worker API handles FK restriction on delete and hospital validation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

const DOCTOR_TITLES = [
  "主任医师",
  "副主任医师",
  "主治医师",
  "住院医师",
  "其他",
] as const;

export function registerDoctorTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-doctors
  // -------------------------------------------------------------------------
  server.tool(
    "list-doctors",
    "List all doctors with hospital names and visit counts",
    {
      hospitalId: z.number().optional().describe("Filter by hospital ID"),
    },
    async ({ hospitalId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const path = hospitalId !== undefined
          ? `/api/doctors?hospitalId=${hospitalId}`
          : "/api/doctors";
        const doctors = await apiGet(path);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(doctors) }],
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
  // get-doctor
  // -------------------------------------------------------------------------
  server.tool(
    "get-doctor",
    "Get detailed information about a doctor",
    { doctorId: z.number().describe("The doctor ID to look up") },
    async ({ doctorId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const doctor = await apiGet(`/api/doctors/${doctorId}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(doctor) }],
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
  // create-doctor
  // -------------------------------------------------------------------------
  server.tool(
    "create-doctor",
    "Create a new doctor",
    {
      name: z.string().min(1).describe("Doctor name (required, non-empty)"),
      hospitalId: z.number().describe("Hospital ID the doctor belongs to"),
      department: z.string().min(1).describe("Department (required, non-empty)"),
      title: z
        .enum(DOCTOR_TITLES)
        .optional()
        .describe("Professional title"),
      specialty: z.string().optional().describe("Specialty areas"),
      phone: z.string().optional().describe("Contact phone"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const doctor = await apiPost("/api/doctors", stripUndefined(args));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(doctor) }],
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
  // update-doctor
  // -------------------------------------------------------------------------
  server.tool(
    "update-doctor",
    "Update a doctor (pass null to clear optional fields). Cannot change hospital if doctor has medical visits.",
    {
      doctorId: z.number().describe("The doctor ID to update"),
      name: z.string().optional().describe("Doctor name"),
      hospitalId: z.number().optional().describe("Hospital ID (cannot change if doctor has visits)"),
      department: z.string().optional().describe("Department"),
      title: z.enum(DOCTOR_TITLES).nullable().optional().describe("Professional title (null to clear)"),
      specialty: z.string().nullable().optional().describe("Specialty areas (null to clear)"),
      phone: z.string().nullable().optional().describe("Contact phone (null to clear)"),
      notes: z.string().nullable().optional().describe("Additional notes (null to clear)"),
    },
    async ({ doctorId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(`/api/doctors/${doctorId}`, stripUndefined(data));
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
  // delete-doctor
  // -------------------------------------------------------------------------
  server.tool(
    "delete-doctor",
    "Delete a doctor (fails if referenced by medical visits)",
    {
      doctorId: z.number().describe("The doctor ID to delete"),
    },
    async ({ doctorId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/doctors/${doctorId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: doctorId }),
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
