import { eq } from "drizzle-orm";
import { db } from "../index";
import { assets, type Asset, type NewAsset } from "../schema";

export const assetsRepo = {
  findAll(): Asset[] {
    return db.select().from(assets).all();
  },

  findById(id: number): Asset | undefined {
    return db.select().from(assets).where(eq(assets.id, id)).get();
  },

  findByOwnerId(ownerId: number): Asset[] {
    return db.select().from(assets).where(eq(assets.ownerId, ownerId)).all();
  },

  create(data: NewAsset): Asset {
    return db.insert(assets).values(data).returning().get();
  },

  update(id: number, data: Partial<NewAsset>): Asset | undefined {
    return db
      .update(assets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(assets.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(assets).where(eq(assets.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  },
};
