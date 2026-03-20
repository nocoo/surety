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
      return await dbInstance.insert(payments).values(data).returning().all();
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
      const rows = await dbInstance.delete(payments).where(eq(payments.id, id)).returning().all();
      return rows.length > 0;
    },

    async deleteByPolicyId(policyId: number): Promise<number> {
      const rows = await dbInstance
        .delete(payments)
        .where(eq(payments.policyId, policyId))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type PaymentsRepo = ReturnType<typeof createPaymentsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const paymentsRepo = createPaymentsRepo(db);
