import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { payments, type Payment, type NewPayment } from "../schema";

export function createPaymentsRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Payment[]> {
      return await dbInstance.select().from(payments).all();
    },

    async findById(id: number): Promise<Payment | undefined> {
      return await dbInstance.select().from(payments).where(eq(payments.id, id)).get();
    },

    async findByPolicyId(policyId: number): Promise<Payment[]> {
      return await dbInstance
        .select()
        .from(payments)
        .where(eq(payments.policyId, policyId))
        .all();
    },

    async findByStatus(status: Payment["status"]): Promise<Payment[]> {
      return await dbInstance.select().from(payments).where(eq(payments.status, status)).all();
    },

    async create(data: NewPayment): Promise<Payment> {
      return await dbInstance.insert(payments).values(data).returning().get();
    },

    async createMany(data: NewPayment[]): Promise<Payment[]> {
      // D1 has a bound parameter limit (~100). Batch insert in chunks.
      const batchSize = 10;
      const results: Payment[] = [];

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const inserted = await dbInstance.insert(payments).values(batch).returning().all();
        results.push(...inserted);
      }

      return results;
    },

    async update(id: number, data: Partial<NewPayment>): Promise<Payment | undefined> {
      return await dbInstance
        .update(payments)
        .set(data)
        .where(eq(payments.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const result = await dbInstance.delete(payments).where(eq(payments.id, id)).run();
      return (result.changes ?? result.rowsAffected ?? 0) > 0;
    },

    async deleteByPolicyId(policyId: number): Promise<number> {
      const result = await dbInstance
        .delete(payments)
        .where(eq(payments.policyId, policyId))
        .run();
      return result.changes ?? result.rowsAffected ?? 0;
    },
  };
}

export type PaymentsRepo = ReturnType<typeof createPaymentsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const paymentsRepo = createPaymentsRepo(db);
