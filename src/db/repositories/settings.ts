import { eq } from "drizzle-orm";
import { db } from "../index";
import { settings, type Setting } from "../schema";

export const settingsRepo = {
  findAll(): Setting[] {
    return db.select().from(settings).all();
  },

  get(key: string): string | undefined {
    const setting = db.select().from(settings).where(eq(settings.key, key)).get();
    return setting?.value;
  },

  set(key: string, value: string): Setting {
    const existing = db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .get();

    if (existing) {
      return db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning()
        .get();
    }

    return db.insert(settings).values({ key, value }).returning().get();
  },

  delete(key: string): boolean {
    const result = db.delete(settings).where(eq(settings.key, key)).run();
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
