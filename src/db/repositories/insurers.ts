import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { insurers, type Insurer, type NewInsurer } from "../schema";

export function createInsurersRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Insurer[]> {
      return await dbInstance.select().from(insurers).all();
    },

    async findById(id: number): Promise<Insurer | undefined> {
      return await dbInstance.select().from(insurers).where(eq(insurers.id, id)).get();
    },

    async findByName(name: string): Promise<Insurer | undefined> {
      return await dbInstance.select().from(insurers).where(eq(insurers.name, name)).get();
    },

    async create(data: NewInsurer): Promise<Insurer> {
      return await dbInstance.insert(insurers).values(data).returning().get();
    },

    async findOrCreate(name: string): Promise<Insurer & { created: boolean }> {
      const existing = await this.findByName(name);
      if (existing) return { ...existing, created: false };
      const created = await this.create({ name });
      return { ...created, created: true };
    },

    async update(id: number, data: Partial<NewInsurer>): Promise<Insurer | undefined> {
      return await dbInstance
        .update(insurers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(insurers.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance.delete(insurers).where(eq(insurers.id, id)).returning().all();
      return rows.length > 0;
    },
  };
}

export type InsurersRepo = ReturnType<typeof createInsurersRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const insurersRepo = createInsurersRepo(db);
