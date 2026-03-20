import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { assets, type Asset, type NewAsset } from "../schema";

export function createAssetsRepo(dbInstance: DbInstance) {
  return {
    findAll(): Asset[] {
      return dbInstance.select().from(assets).all();
    },

    findById(id: number): Asset | undefined {
      return dbInstance.select().from(assets).where(eq(assets.id, id)).get();
    },

    findByOwnerId(ownerId: number): Asset[] {
      return dbInstance.select().from(assets).where(eq(assets.ownerId, ownerId)).all();
    },

    create(data: NewAsset): Asset {
      return dbInstance.insert(assets).values(data).returning().get();
    },

    update(id: number, data: Partial<NewAsset>): Asset | undefined {
      return dbInstance
        .update(assets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(assets.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(assets).where(eq(assets.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },
  };
}

export type AssetsRepo = ReturnType<typeof createAssetsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const assetsRepo = createAssetsRepo(db);
