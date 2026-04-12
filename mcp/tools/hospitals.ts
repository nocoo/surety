/**
 * MCP Tools: Hospitals
 *
 * Tools for managing hospitals.
 * delete-hospital restricts if referenced by doctors or medical visits.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  hospitalsRepo,
  doctorsRepo,
  medicalVisitsRepo,
} from "@/db/repositories";
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

      const hospitals = await hospitalsRepo.findAll();
      const doctors = await doctorsRepo.findAll();

      // Count doctors per hospital
      const doctorCountMap = new Map<number, number>();
      for (const d of doctors) {
        doctorCountMap.set(d.hospitalId, (doctorCountMap.get(d.hospitalId) ?? 0) + 1);
      }

      const result = hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        level: h.level,
        isPublic: h.isPublic,
        address: h.address,
        phone: h.phone,
        doctorCount: doctorCountMap.get(h.id) ?? 0,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      const hospital = await hospitalsRepo.findById(hospitalId);
      if (!hospital) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Hospital with id ${hospitalId} not found`,
            },
          ],
        };
      }

      // Get doctors at this hospital
      const doctors = await doctorsRepo.findByHospitalId(hospitalId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...hospital,
              doctors: doctors.map((d) => ({
                id: d.id,
                name: d.name,
                department: d.department,
                title: d.title,
              })),
            }),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // create-hospital
  // -------------------------------------------------------------------------
  server.tool(
    "create-hospital",
    "Create a new hospital",
    {
      name: z.string().describe("Hospital name"),
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

      const hospital = await hospitalsRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(hospital) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-hospital
  // -------------------------------------------------------------------------
  server.tool(
    "update-hospital",
    "Update a hospital",
    {
      hospitalId: z.number().describe("The hospital ID to update"),
      name: z.string().optional().describe("Hospital name"),
      level: z
        .enum(HOSPITAL_LEVELS)
        .optional()
        .describe("Hospital level"),
      isPublic: z.boolean().optional().describe("Whether public hospital"),
      address: z.string().optional().describe("Hospital address"),
      phone: z.string().optional().describe("Contact phone"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async ({ hospitalId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const updated = await hospitalsRepo.update(hospitalId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Hospital with id ${hospitalId} not found`,
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

      const hospital = await hospitalsRepo.findById(hospitalId);
      if (!hospital) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Hospital with id ${hospitalId} not found`,
            },
          ],
        };
      }

      // Check referencing doctors
      const doctors = await doctorsRepo.findByHospitalId(hospitalId);
      if (doctors.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Cannot delete hospital: still referenced by doctors",
                doctorCount: doctors.length,
                doctors: doctors.slice(0, 5).map((d) => ({
                  id: d.id,
                  name: d.name,
                })),
              }),
            },
          ],
        };
      }

      // Check referencing medical visits
      const visits = await medicalVisitsRepo.findByHospitalId(hospitalId);
      if (visits.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Cannot delete hospital: still referenced by medical visits",
                visitCount: visits.length,
              }),
            },
          ],
        };
      }

      await hospitalsRepo.delete(hospitalId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: hospitalId }),
          },
        ],
      };
    },
  );
}
