import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { payments, type Payment, type NewPayment } from "../schema";

export function createPaymentsRepo(dbInstance: DbInstance) {
  return {
    findAll(): Payment[] {
      return dbInstance.select().from(payments).all();
    },

    findById(id: number): Payment | undefined {
      return dbInstance.select().from(payments).where(eq(payments.id, id)).get();
    },

    findByPolicyId(policyId: number): Payment[] {
      return dbInstance
        .select()
        .from(payments)
        .where(eq(payments.policyId, policyId))
        .all();
    },

    findByStatus(status: Payment["status"]): Payment[] {
      return dbInstance.select().from(payments).where(eq(payments.status, status)).all();
    },

    create(data: NewPayment): Payment {
      return dbInstance.insert(payments).values(data).returning().get();
    },

    createMany(data: NewPayment[]): Payment[] {
      return dbInstance.insert(payments).values(data).returning().all();
    },

    update(id: number, data: Partial<NewPayment>): Payment | undefined {
      return dbInstance
        .update(payments)
        .set(data)
        .where(eq(payments.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(payments).where(eq(payments.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },

    deleteByPolicyId(policyId: number): number {
      const result = dbInstance
        .delete(payments)
        .where(eq(payments.policyId, policyId))
        .run() as unknown as { changes: number };
      return result.changes;
    },
  };
}

export type PaymentsRepo = ReturnType<typeof createPaymentsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const paymentsRepo = createPaymentsRepo(db);
