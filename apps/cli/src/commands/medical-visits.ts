import { defineCrudCommand } from "../lib/crud.js";

interface MedicalVisit extends Record<string, unknown> {
  id: number;
  memberId: number;
  hospitalId: number;
  doctorId?: number | null;
  visitDate: string;
  visitReason: string;
}

export const medicalVisitsCommand = defineCrudCommand<MedicalVisit>({
  name: "medical-visits",
  description: "Manage medical visit records",
  basePath: "/api/medical-visits",
  summarize: (v) => ({
    id: v.id,
    memberId: v.memberId,
    hospitalId: v.hospitalId,
    visitDate: v.visitDate,
    visitReason: v.visitReason,
  }),
});
