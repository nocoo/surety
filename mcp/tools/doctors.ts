/**
 * MCP Tools: Doctors
 *
 * Tools for managing doctors.
 * delete-doctor restricts if referenced by medical visits.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  doctorsRepo,
  hospitalsRepo,
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

      let doctors;
      if (hospitalId !== undefined) {
        doctors = await doctorsRepo.findByHospitalId(hospitalId);
      } else {
        doctors = await doctorsRepo.findAll();
      }

      // Get hospital names
      const hospitals = await hospitalsRepo.findAll();
      const hospitalMap = new Map(hospitals.map((h) => [h.id, h.name]));

      // Get visit counts
      const allVisits = await medicalVisitsRepo.findAll();
      const visitCountMap = new Map<number, number>();
      for (const v of allVisits) {
        if (v.doctorId) {
          visitCountMap.set(v.doctorId, (visitCountMap.get(v.doctorId) ?? 0) + 1);
        }
      }

      const result = doctors.map((d) => ({
        id: d.id,
        name: d.name,
        hospitalId: d.hospitalId,
        hospitalName: hospitalMap.get(d.hospitalId) ?? null,
        department: d.department,
        title: d.title,
        specialty: d.specialty,
        phone: d.phone,
        visitCount: visitCountMap.get(d.id) ?? 0,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      const doctor = await doctorsRepo.findById(doctorId);
      if (!doctor) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Doctor with id ${doctorId} not found`,
            },
          ],
        };
      }

      const hospital = await hospitalsRepo.findById(doctor.hospitalId);
      const visits = await medicalVisitsRepo.findByDoctorId(doctorId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...doctor,
              hospitalName: hospital?.name ?? null,
              visitCount: visits.length,
            }),
          },
        ],
      };
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

      // Verify hospital exists
      const hospital = await hospitalsRepo.findById(args.hospitalId);
      if (!hospital) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Hospital with id ${args.hospitalId} not found`,
            },
          ],
        };
      }

      const doctor = await doctorsRepo.create(stripUndefined(args));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...doctor,
              hospitalName: hospital.name,
            }),
          },
        ],
      };
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

      // Check if doctor exists first
      const existing = await doctorsRepo.findById(doctorId);
      if (!existing) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Doctor with id ${doctorId} not found`,
            },
          ],
        };
      }

      // Verify hospital exists if being updated, and check visit constraint
      if (data.hospitalId !== undefined && data.hospitalId !== existing.hospitalId) {
        const hospital = await hospitalsRepo.findById(data.hospitalId);
        if (!hospital) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Hospital with id ${data.hospitalId} not found`,
              },
            ],
          };
        }

        // Cannot change hospital if doctor has medical visits
        const visits = await medicalVisitsRepo.findByDoctorId(doctorId);
        if (visits.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Cannot change hospital: doctor has medical visits",
                  visitCount: visits.length,
                }),
              },
            ],
          };
        }
      }

      // Validate department is not empty if provided
      if (data.department !== undefined && !data.department.trim()) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Department cannot be empty",
            },
          ],
        };
      }

      const updated = await doctorsRepo.update(doctorId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Doctor with id ${doctorId} not found`,
            },
          ],
        };
      }

      const hospital = await hospitalsRepo.findById(updated.hospitalId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...updated,
              hospitalName: hospital?.name ?? null,
            }),
          },
        ],
      };
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

      const doctor = await doctorsRepo.findById(doctorId);
      if (!doctor) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Doctor with id ${doctorId} not found`,
            },
          ],
        };
      }

      // Check referencing medical visits
      const visits = await medicalVisitsRepo.findByDoctorId(doctorId);
      if (visits.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Cannot delete doctor: still referenced by medical visits",
                visitCount: visits.length,
              }),
            },
          ],
        };
      }

      await doctorsRepo.delete(doctorId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: doctorId }),
          },
        ],
      };
    },
  );
}
