import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  coverageItems,
  type CoverageItem,
  type NewCoverageItem,
} from "../schema";

export const coverageItemsRepo = {
  findAll(): CoverageItem[] {
    return db.select().from(coverageItems).all();
  },

  findById(id: number): CoverageItem | undefined {
    return db
      .select()
      .from(coverageItems)
      .where(eq(coverageItems.id, id))
      .get();
  },

  findByPolicyId(policyId: number): CoverageItem[] {
    return db
      .select()
      .from(coverageItems)
      .where(eq(coverageItems.policyId, policyId))
      .all();
  },

  create(data: NewCoverageItem): CoverageItem {
    return db.insert(coverageItems).values(data).returning().get();
  },

  createMany(data: NewCoverageItem[]): CoverageItem[] {
    if (data.length === 0) return [];
    return db.insert(coverageItems).values(data).returning().all();
  },

  update(
    id: number,
    data: Partial<NewCoverageItem>
  ): CoverageItem | undefined {
    return db
      .update(coverageItems)
      .set(data)
      .where(eq(coverageItems.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db
      .delete(coverageItems)
      .where(eq(coverageItems.id, id))
      .run() as unknown as { changes: number };
    return result.changes > 0;
  },

  deleteByPolicyId(policyId: number): number {
    const result = db
      .delete(coverageItems)
      .where(eq(coverageItems.policyId, policyId))
      .run() as unknown as { changes: number };
    return result.changes;
  },
};
