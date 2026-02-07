import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  policyExtensions,
  type PolicyExtension,
  type NewPolicyExtension,
} from "../schema";

export const policyExtensionsRepo = {
  findAll(): PolicyExtension[] {
    return db.select().from(policyExtensions).all();
  },

  findById(id: number): PolicyExtension | undefined {
    return db
      .select()
      .from(policyExtensions)
      .where(eq(policyExtensions.id, id))
      .get();
  },

  findByPolicyId(policyId: number): PolicyExtension | undefined {
    return db
      .select()
      .from(policyExtensions)
      .where(eq(policyExtensions.policyId, policyId))
      .get();
  },

  create(data: NewPolicyExtension): PolicyExtension {
    return db.insert(policyExtensions).values(data).returning().get();
  },

  update(
    id: number,
    data: Partial<NewPolicyExtension>
  ): PolicyExtension | undefined {
    return db
      .update(policyExtensions)
      .set(data)
      .where(eq(policyExtensions.id, id))
      .returning()
      .get();
  },

  upsertByPolicyId(
    policyId: number,
    jsonData: Record<string, unknown>
  ): PolicyExtension {
    const existing = this.findByPolicyId(policyId);
    const dataStr = JSON.stringify(jsonData);

    if (existing) {
      return db
        .update(policyExtensions)
        .set({ data: dataStr })
        .where(eq(policyExtensions.policyId, policyId))
        .returning()
        .get();
    }

    return db
      .insert(policyExtensions)
      .values({ policyId, data: dataStr })
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db
      .delete(policyExtensions)
      .where(eq(policyExtensions.id, id))
      .run() as unknown as { changes: number };
    return result.changes > 0;
  },

  deleteByPolicyId(policyId: number): boolean {
    const result = db
      .delete(policyExtensions)
      .where(eq(policyExtensions.policyId, policyId))
      .run() as unknown as { changes: number };
    return result.changes > 0;
  },

  parseData<T>(extension: PolicyExtension): T {
    return JSON.parse(extension.data) as T;
  },
};
