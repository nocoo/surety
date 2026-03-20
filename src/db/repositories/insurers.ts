import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { insurers, type Insurer, type NewInsurer } from "../schema";

export function createInsurersRepo(dbInstance: DbInstance) {
  return {
    findAll(): Insurer[] {
      return dbInstance.select().from(insurers).all();
    },

    findById(id: number): Insurer | undefined {
      return dbInstance.select().from(insurers).where(eq(insurers.id, id)).get();
    },

    findByName(name: string): Insurer | undefined {
      return dbInstance.select().from(insurers).where(eq(insurers.name, name)).get();
    },

    create(data: NewInsurer): Insurer {
      return dbInstance.insert(insurers).values(data).returning().get();
    },

    findOrCreate(name: string): Insurer {
      const existing = this.findByName(name);
      if (existing) return existing;
      return this.create({ name });
    },

    update(id: number, data: Partial<NewInsurer>): Insurer | undefined {
      return dbInstance
        .update(insurers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(insurers.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(insurers).where(eq(insurers.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },
  };
}

export type InsurersRepo = ReturnType<typeof createInsurersRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const insurersRepo = createInsurersRepo(db);
