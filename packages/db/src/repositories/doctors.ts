import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { doctors, type Doctor, type NewDoctor } from "../schema";

export function createDoctorsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Doctor[]> {
      return await dbInstance.select().from(doctors).all();
    },

    async findById(id: number): Promise<Doctor | undefined> {
      return await dbInstance.select().from(doctors).where(eq(doctors.id, id)).get();
    },

    async findByHospitalId(hospitalId: number): Promise<Doctor[]> {
      return await dbInstance
        .select()
        .from(doctors)
        .where(eq(doctors.hospitalId, hospitalId))
        .all();
    },

    async create(data: NewDoctor): Promise<Doctor> {
      return await dbInstance.insert(doctors).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewDoctor>): Promise<Doctor | undefined> {
      return await dbInstance
        .update(doctors)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(doctors.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance.delete(doctors).where(eq(doctors.id, id)).returning().all();
      return rows.length > 0;
    },
  };
}

export type DoctorsRepo = ReturnType<typeof createDoctorsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const doctorsRepo = createDoctorsRepo(db);
