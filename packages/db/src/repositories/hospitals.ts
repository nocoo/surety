import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { hospitals, type Hospital, type NewHospital } from "../schema";

export function createHospitalsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Hospital[]> {
      return await dbInstance.select().from(hospitals).all();
    },

    async findById(id: number): Promise<Hospital | undefined> {
      return await dbInstance.select().from(hospitals).where(eq(hospitals.id, id)).get();
    },

    async findByName(name: string): Promise<Hospital[]> {
      // Returns array since hospital names are not unique
      return await dbInstance.select().from(hospitals).where(eq(hospitals.name, name)).all();
    },

    async create(data: NewHospital): Promise<Hospital> {
      return await dbInstance.insert(hospitals).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewHospital>): Promise<Hospital | undefined> {
      return await dbInstance
        .update(hospitals)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(hospitals.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance.delete(hospitals).where(eq(hospitals.id, id)).returning().all();
      return rows.length > 0;
    },
  };
}

export type HospitalsRepo = ReturnType<typeof createHospitalsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const hospitalsRepo = createHospitalsRepo(db);
