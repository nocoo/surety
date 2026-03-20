import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { cashValues, type CashValue, type NewCashValue } from "../schema";

export function createCashValuesRepo(dbInstance: DbInstance) {
  return {
    findAll(): CashValue[] {
      return dbInstance.select().from(cashValues).all();
    },

    findById(id: number): CashValue | undefined {
      return dbInstance.select().from(cashValues).where(eq(cashValues.id, id)).get();
    },

    findByPolicyId(policyId: number): CashValue[] {
      return dbInstance
        .select()
        .from(cashValues)
        .where(eq(cashValues.policyId, policyId))
        .all();
    },

    create(data: NewCashValue): CashValue {
      return dbInstance.insert(cashValues).values(data).returning().get();
    },

    createMany(data: NewCashValue[]): CashValue[] {
      return dbInstance.insert(cashValues).values(data).returning().all();
    },

    update(id: number, data: Partial<NewCashValue>): CashValue | undefined {
      return dbInstance
        .update(cashValues)
        .set(data)
        .where(eq(cashValues.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(cashValues).where(eq(cashValues.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },

    deleteByPolicyId(policyId: number): number {
      const result = dbInstance
        .delete(cashValues)
        .where(eq(cashValues.policyId, policyId))
        .run() as unknown as { changes: number };
      return result.changes;
    },
  };
}

export type CashValuesRepo = ReturnType<typeof createCashValuesRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const cashValuesRepo = createCashValuesRepo(db);
