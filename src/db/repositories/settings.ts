import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { settings, type Setting } from "../schema";

export function createSettingsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Setting[]> {
      return await dbInstance.select().from(settings).all();
    },

    async get(key: string): Promise<string | undefined> {
      const setting = await dbInstance.select().from(settings).where(eq(settings.key, key)).get();
      return setting?.value;
    },

    async set(key: string, value: string): Promise<Setting> {
      const existing = await dbInstance
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      if (existing) {
        return await dbInstance
          .update(settings)
          .set({ value, updatedAt: new Date() })
          .where(eq(settings.key, key))
          .returning()
          .get();
      }

      return await dbInstance.insert(settings).values({ key, value }).returning().get();
    },

    async delete(key: string): Promise<boolean> {
      const rows = await dbInstance.delete(settings).where(eq(settings.key, key)).returning().all();
      return rows.length > 0;
    },

    async getNumber(key: string): Promise<number | undefined> {
      const value = await this.get(key);
      if (value === undefined) return undefined;
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    },

    async setNumber(key: string, value: number): Promise<Setting> {
      return await this.set(key, String(value));
    },

    async getJson<T>(key: string): Promise<T | undefined> {
      const value = await this.get(key);
      if (value === undefined) return undefined;
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    },

    async setJson(key: string, value: unknown): Promise<Setting> {
      return await this.set(key, JSON.stringify(value));
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const settingsRepo = createSettingsRepo(db);
