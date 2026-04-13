import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { assets, type Asset, type NewAsset } from "../schema";

export function createAssetsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Asset[]> {
      return await dbInstance.select().from(assets).all();
    },

    async findById(id: number): Promise<Asset | undefined> {
      return await dbInstance.select().from(assets).where(eq(assets.id, id)).get();
    },

    async findByOwnerId(ownerId: number): Promise<Asset[]> {
      return await dbInstance.select().from(assets).where(eq(assets.ownerId, ownerId)).all();
    },

    async create(data: NewAsset): Promise<Asset> {
      return await dbInstance.insert(assets).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewAsset>): Promise<Asset | undefined> {
      return await dbInstance
        .update(assets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(assets.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const result = await dbInstance.delete(assets).where(eq(assets.id, id)).run();
      return (result.changes ?? result.rowsAffected ?? 0) > 0;
    },
  };
}

export type AssetsRepo = ReturnType<typeof createAssetsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const assetsRepo = createAssetsRepo(db);
