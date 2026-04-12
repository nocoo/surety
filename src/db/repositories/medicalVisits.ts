import { eq, desc } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { medicalVisits, type MedicalVisit, type NewMedicalVisit } from "../schema";

export function createMedicalVisitsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<MedicalVisit[]> {
      return await dbInstance
        .select()
        .from(medicalVisits)
        .orderBy(desc(medicalVisits.visitDate))
        .all();
    },

    async findById(id: number): Promise<MedicalVisit | undefined> {
      return await dbInstance
        .select()
        .from(medicalVisits)
        .where(eq(medicalVisits.id, id))
        .get();
    },

    async findByMemberId(memberId: number): Promise<MedicalVisit[]> {
      return await dbInstance
        .select()
        .from(medicalVisits)
        .where(eq(medicalVisits.memberId, memberId))
        .orderBy(desc(medicalVisits.visitDate))
        .all();
    },

    async findByHospitalId(hospitalId: number): Promise<MedicalVisit[]> {
      return await dbInstance
        .select()
        .from(medicalVisits)
        .where(eq(medicalVisits.hospitalId, hospitalId))
        .all();
    },

    async findByDoctorId(doctorId: number): Promise<MedicalVisit[]> {
      return await dbInstance
        .select()
        .from(medicalVisits)
        .where(eq(medicalVisits.doctorId, doctorId))
        .all();
    },

    async create(data: NewMedicalVisit): Promise<MedicalVisit> {
      return await dbInstance.insert(medicalVisits).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewMedicalVisit>): Promise<MedicalVisit | undefined> {
      return await dbInstance
        .update(medicalVisits)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(medicalVisits.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance
        .delete(medicalVisits)
        .where(eq(medicalVisits.id, id))
        .returning()
        .all();
      return rows.length > 0;
    },
  };
}

export type MedicalVisitsRepo = ReturnType<typeof createMedicalVisitsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const medicalVisitsRepo = createMedicalVisitsRepo(db);
