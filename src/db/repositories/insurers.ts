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
      // Try INSERT with ON CONFLICT DO NOTHING — concurrent-safe.
      // If the name already exists, this is a no-op and returns no rows.
      const inserted = await dbInstance
        .insert(insurers)
        .values({ name })
        .onConflictDoNothing({ target: insurers.name })
        .returning()
        .all();

      if (inserted.length > 0 && inserted[0]) {
        return { ...inserted[0], created: true };
      }

      // Name already existed (conflict) — fetch the existing row
      const existing = await this.findByName(name);
      if (!existing) throw new Error(`Insurer "${name}" not found after conflict`);
      return { ...existing, created: false };
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
