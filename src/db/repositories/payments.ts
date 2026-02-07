import { eq } from "drizzle-orm";
import { db } from "../index";
import { payments, type Payment, type NewPayment } from "../schema";

export const paymentsRepo = {
  findAll(): Payment[] {
    return db.select().from(payments).all();
  },

  findById(id: number): Payment | undefined {
    return db.select().from(payments).where(eq(payments.id, id)).get();
  },

  findByPolicyId(policyId: number): Payment[] {
    return db
      .select()
      .from(payments)
      .where(eq(payments.policyId, policyId))
      .all();
  },

  findByStatus(status: Payment["status"]): Payment[] {
    return db.select().from(payments).where(eq(payments.status, status)).all();
  },

  create(data: NewPayment): Payment {
    return db.insert(payments).values(data).returning().get();
  },

  createMany(data: NewPayment[]): Payment[] {
    return db.insert(payments).values(data).returning().all();
  },

  update(id: number, data: Partial<NewPayment>): Payment | undefined {
    return db
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(payments).where(eq(payments.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  },

  deleteByPolicyId(policyId: number): number {
    const result = db
      .delete(payments)
      .where(eq(payments.policyId, policyId))
      .run() as unknown as { changes: number };
    return result.changes;
  },
};
