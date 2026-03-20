import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { settings, type Setting } from "../schema";

export function createSettingsRepo(dbInstance: DbInstance) {
  return {
    findAll(): Setting[] {
      return dbInstance.select().from(settings).all();
    },

    get(key: string): string | undefined {
      const setting = dbInstance.select().from(settings).where(eq(settings.key, key)).get();
      return setting?.value;
    },

    set(key: string, value: string): Setting {
      const existing = dbInstance
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      if (existing) {
        return dbInstance
          .update(settings)
          .set({ value, updatedAt: new Date() })
          .where(eq(settings.key, key))
          .returning()
          .get();
      }

      return dbInstance.insert(settings).values({ key, value }).returning().get();
    },

    delete(key: string): boolean {
      const result = dbInstance.delete(settings).where(eq(settings.key, key)).run() as unknown as { changes: number };
      return result.changes > 0;
    },

    getNumber(key: string): number | undefined {
      const value = this.get(key);
      if (value === undefined) return undefined;
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    },

    setNumber(key: string, value: number): Setting {
      return this.set(key, String(value));
    },

    getJson<T>(key: string): T | undefined {
      const value = this.get(key);
      if (value === undefined) return undefined;
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    },

    setJson(key: string, value: unknown): Setting {
      return this.set(key, JSON.stringify(value));
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const settingsRepo = createSettingsRepo(db);
