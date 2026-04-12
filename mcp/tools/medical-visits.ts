/**
 * MCP Tools: Medical Visits
 *
 * Tools for managing medical visit records.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  medicalVisitsRepo,
  membersRepo,
  hospitalsRepo,
  doctorsRepo,
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

      let visits;
      if (memberId !== undefined) {
        visits = await medicalVisitsRepo.findByMemberId(memberId);
      } else if (hospitalId !== undefined) {
        visits = await medicalVisitsRepo.findByHospitalId(hospitalId);
      } else if (doctorId !== undefined) {
        visits = await medicalVisitsRepo.findByDoctorId(doctorId);
      } else {
        visits = await medicalVisitsRepo.findAll();
      }

      // Get lookup maps
      const members = await membersRepo.findAll();
      const memberMap = new Map(members.map((m) => [m.id, m]));

      const hospitals = await hospitalsRepo.findAll();
      const hospitalMap = new Map(hospitals.map((h) => [h.id, h.name]));

      const doctors = await doctorsRepo.findAll();
      const doctorMap = new Map(doctors.map((d) => [d.id, d.name]));

      const result = visits.map((v) => {
        const member = memberMap.get(v.memberId);
        return {
          id: v.id,
          memberId: v.memberId,
          memberName: member?.name ?? null,
          hospitalId: v.hospitalId,
          hospitalName: hospitalMap.get(v.hospitalId) ?? null,
          doctorId: v.doctorId,
          doctorName: v.doctorId ? doctorMap.get(v.doctorId) ?? null : null,
          visitDate: v.visitDate,
          visitType: v.visitType,
          visitReason: v.visitReason,
          department: v.department,
          diagnosis: v.diagnosis,
          totalCost: v.totalCost,
          insurancePaid: v.insurancePaid,
          selfPaid: v.selfPaid,
        };
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
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

      const visit = await medicalVisitsRepo.findById(visitId);
      if (!visit) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Medical visit with id ${visitId} not found`,
            },
          ],
        };
      }

      const member = await membersRepo.findById(visit.memberId);
      const hospital = await hospitalsRepo.findById(visit.hospitalId);
      const doctor = visit.doctorId
        ? await doctorsRepo.findById(visit.doctorId)
        : null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...visit,
              memberName: member?.name ?? null,
              memberBirthDate: member?.birthDate ?? null,
              hospitalName: hospital?.name ?? null,
              doctorName: doctor?.name ?? null,
            }),
          },
        ],
      };
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
      assessment: z.string().optional().describe("Assessment notes"),
      treatment: z.string().optional().describe("Treatment/prescription"),
      totalCost: z.number().optional().describe("Total cost"),
      insurancePaid: z.number().optional().describe("Insurance paid amount"),
      selfPaid: z.number().optional().describe("Self-paid amount"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Verify member exists
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

      // Verify doctor exists and belongs to hospital if provided
      let doctor = null;
      if (args.doctorId !== undefined) {
        doctor = await doctorsRepo.findById(args.doctorId);
        if (!doctor) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Doctor with id ${args.doctorId} not found`,
              },
            ],
          };
        }
        if (doctor.hospitalId !== args.hospitalId) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Doctor does not belong to the specified hospital",
              },
            ],
          };
        }
      }

      // Validate cost consistency
      if (
        args.totalCost !== undefined &&
        args.insurancePaid !== undefined &&
        args.selfPaid !== undefined
      ) {
        const expected = args.insurancePaid + args.selfPaid;
        if (Math.abs(args.totalCost - expected) > 0.01) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Cost inconsistency: totalCost ≠ insurancePaid + selfPaid",
              },
            ],
          };
        }
      }

      const visit = await medicalVisitsRepo.create(stripUndefined(args));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...visit,
              memberName: member.name,
              hospitalName: hospital.name,
              doctorName: doctor?.name ?? null,
            }),
          },
        ],
      };
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
      assessment: z.string().nullable().optional().describe("Assessment notes (null to clear)"),
      treatment: z.string().nullable().optional().describe("Treatment/prescription (null to clear)"),
      totalCost: z.number().nullable().optional().describe("Total cost (null to clear)"),
      insurancePaid: z.number().nullable().optional().describe("Insurance paid amount (null to clear)"),
      selfPaid: z.number().nullable().optional().describe("Self-paid amount (null to clear)"),
      notes: z.string().nullable().optional().describe("Additional notes (null to clear)"),
    },
    async ({ visitId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const existing = await medicalVisitsRepo.findById(visitId);
      if (!existing) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Medical visit with id ${visitId} not found`,
            },
          ],
        };
      }

      // Verify member exists if being updated
      if (data.memberId !== undefined && data.memberId !== existing.memberId) {
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

      // Determine effective hospitalId
      const hospitalId = data.hospitalId ?? existing.hospitalId;

      // Verify hospital exists if being updated
      if (data.hospitalId !== undefined) {
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
      }

      // Determine effective doctorId
      const effectiveDoctorId =
        data.doctorId === null
          ? null
          : data.doctorId !== undefined
            ? data.doctorId
            : existing.doctorId;

      // Verify doctor exists and belongs to hospital
      if (effectiveDoctorId) {
        const doctor = await doctorsRepo.findById(effectiveDoctorId);
        if (!doctor) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Doctor with id ${effectiveDoctorId} not found`,
              },
            ],
          };
        }
        if (doctor.hospitalId !== hospitalId) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Doctor does not belong to the specified hospital",
              },
            ],
          };
        }
      }

      // Validate cost consistency
      const totalCost = data.totalCost ?? existing.totalCost;
      const insurancePaid = data.insurancePaid ?? existing.insurancePaid;
      const selfPaid = data.selfPaid ?? existing.selfPaid;
      if (totalCost != null && insurancePaid != null && selfPaid != null) {
        const expected = insurancePaid + selfPaid;
        if (Math.abs(totalCost - expected) > 0.01) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Cost inconsistency: totalCost ≠ insurancePaid + selfPaid",
              },
            ],
          };
        }
      }

      const updated = await medicalVisitsRepo.update(visitId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Medical visit with id ${visitId} not found`,
            },
          ],
        };
      }

      const member = await membersRepo.findById(updated.memberId);
      const hospital = await hospitalsRepo.findById(updated.hospitalId);
      const doctor = updated.doctorId
        ? await doctorsRepo.findById(updated.doctorId)
        : null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...updated,
              memberName: member?.name ?? null,
              hospitalName: hospital?.name ?? null,
              doctorName: doctor?.name ?? null,
            }),
          },
        ],
      };
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

      const visit = await medicalVisitsRepo.findById(visitId);
      if (!visit) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Medical visit with id ${visitId} not found`,
            },
          ],
        };
      }

      await medicalVisitsRepo.delete(visitId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: visitId }),
          },
        ],
      };
    },
  );
}
