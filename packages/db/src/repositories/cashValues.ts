import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { cashValues, type CashValue, type NewCashValue } from "../schema";

export function createCashValuesRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<CashValue[]> {
      return await dbInstance.select().from(cashValues).all();
    },

    async findById(id: number): Promise<CashValue | undefined> {
      return await dbInstance.select().from(cashValues).where(eq(cashValues.id, id)).get();
    },

    async findByPolicyId(policyId: number): Promise<CashValue[]> {
      return await dbInstance
        .select()
        .from(cashValues)
        .where(eq(cashValues.policyId, policyId))
        .all();
    },

    async create(data: NewCashValue): Promise<CashValue> {
      return await dbInstance.insert(cashValues).values(data).returning().get();
    },

    async createMany(data: NewCashValue[]): Promise<CashValue[]> {
      return await dbInstance.insert(cashValues).values(data).returning().all();
    },

    async update(id: number, data: Partial<NewCashValue>): Promise<CashValue | undefined> {
      return await dbInstance
        .update(cashValues)
        .set(data)
        .where(eq(cashValues.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance.delete(cashValues).where(eq(cashValues.id, id)).returning().all();
      return rows.length > 0;
    },

    async deleteByPolicyId(policyId: number): Promise<number> {
      const rows = await dbInstance
        .delete(cashValues)
        .where(eq(cashValues.policyId, policyId))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type CashValuesRepo = ReturnType<typeof createCashValuesRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const cashValuesRepo = createCashValuesRepo(db);
