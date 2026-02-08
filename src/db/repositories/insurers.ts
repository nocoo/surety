import { eq } from "drizzle-orm";
import { db } from "../index";
import { insurers, type Insurer, type NewInsurer } from "../schema";

export const insurersRepo = {
  findAll(): Insurer[] {
    return db.select().from(insurers).all();
  },

  findById(id: number): Insurer | undefined {
    return db.select().from(insurers).where(eq(insurers.id, id)).get();
  },

  findByName(name: string): Insurer | undefined {
    return db.select().from(insurers).where(eq(insurers.name, name)).get();
  },

  create(data: NewInsurer): Insurer {
    return db.insert(insurers).values(data).returning().get();
  },

  /**
   * Find or create an insurer by name.
   * Used during data migration to avoid duplicates.
   */
  findOrCreate(name: string): Insurer {
    const existing = this.findByName(name);
    if (existing) {
      return existing;
    }
    return this.create({ name });
  },

  update(id: number, data: Partial<NewInsurer>): Insurer | undefined {
    return db
      .update(insurers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(insurers.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(insurers).where(eq(insurers.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  },
};
