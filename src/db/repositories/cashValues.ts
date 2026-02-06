import { eq } from "drizzle-orm";
import { db } from "../index";
import { cashValues, type CashValue, type NewCashValue } from "../schema";

export const cashValuesRepo = {
  findAll(): CashValue[] {
    return db.select().from(cashValues).all();
  },

  findById(id: number): CashValue | undefined {
    return db.select().from(cashValues).where(eq(cashValues.id, id)).get();
  },

  findByPolicyId(policyId: number): CashValue[] {
    return db
      .select()
      .from(cashValues)
      .where(eq(cashValues.policyId, policyId))
      .all();
  },

  create(data: NewCashValue): CashValue {
    return db.insert(cashValues).values(data).returning().get();
  },

  createMany(data: NewCashValue[]): CashValue[] {
    return db.insert(cashValues).values(data).returning().all();
  },

  update(id: number, data: Partial<NewCashValue>): CashValue | undefined {
    return db
      .update(cashValues)
      .set(data)
      .where(eq(cashValues.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(cashValues).where(eq(cashValues.id, id)).run();
    return result.changes > 0;
  },

  deleteByPolicyId(policyId: number): number {
    const result = db
      .delete(cashValues)
      .where(eq(cashValues.policyId, policyId))
      .run();
    return result.changes;
  },
};
