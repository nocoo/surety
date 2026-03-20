import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import {
  coverageItems,
  type CoverageItem,
  type NewCoverageItem,
} from "../schema";

export function createCoverageItemsRepo(dbInstance: DbInstance) {
  return {
    findAll(): CoverageItem[] {
      return dbInstance.select().from(coverageItems).all();
    },

    findById(id: number): CoverageItem | undefined {
      return dbInstance
        .select()
        .from(coverageItems)
        .where(eq(coverageItems.id, id))
        .get();
    },

    findByPolicyId(policyId: number): CoverageItem[] {
      return dbInstance
        .select()
        .from(coverageItems)
        .where(eq(coverageItems.policyId, policyId))
        .all();
    },

    create(data: NewCoverageItem): CoverageItem {
      return dbInstance.insert(coverageItems).values(data).returning().get();
    },

    createMany(data: NewCoverageItem[]): CoverageItem[] {
      if (data.length === 0) return [];
      return dbInstance.insert(coverageItems).values(data).returning().all();
    },

    update(
      id: number,
      data: Partial<NewCoverageItem>,
    ): CoverageItem | undefined {
      return dbInstance
        .update(coverageItems)
        .set(data)
        .where(eq(coverageItems.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance
        .delete(coverageItems)
        .where(eq(coverageItems.id, id))
        .run() as unknown as { changes: number };
      return result.changes > 0;
    },

    deleteByPolicyId(policyId: number): number {
      const result = dbInstance
        .delete(coverageItems)
        .where(eq(coverageItems.policyId, policyId))
        .run() as unknown as { changes: number };
      return result.changes;
    },
  };
}

export type CoverageItemsRepo = ReturnType<typeof createCoverageItemsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const coverageItemsRepo = createCoverageItemsRepo(db);
