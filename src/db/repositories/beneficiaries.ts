import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { beneficiaries, type Beneficiary, type NewBeneficiary } from "../schema";

export function createBeneficiariesRepo(dbInstance: DbInstance) {
  return {
    findAll(): Beneficiary[] {
      return dbInstance.select().from(beneficiaries).all();
    },

    findById(id: number): Beneficiary | undefined {
      return dbInstance.select().from(beneficiaries).where(eq(beneficiaries.id, id)).get();
    },

    findByPolicyId(policyId: number): Beneficiary[] {
      return dbInstance
        .select()
        .from(beneficiaries)
        .where(eq(beneficiaries.policyId, policyId))
        .all();
    },

    create(data: NewBeneficiary): Beneficiary {
      return dbInstance.insert(beneficiaries).values(data).returning().get();
    },

    update(id: number, data: Partial<NewBeneficiary>): Beneficiary | undefined {
      return dbInstance
        .update(beneficiaries)
        .set(data)
        .where(eq(beneficiaries.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(beneficiaries).where(eq(beneficiaries.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },

    deleteByPolicyId(policyId: number): number {
      const result = dbInstance
        .delete(beneficiaries)
        .where(eq(beneficiaries.policyId, policyId))
        .run() as unknown as { changes: number };
      return result.changes;
    },
  };
}

export type BeneficiariesRepo = ReturnType<typeof createBeneficiariesRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const beneficiariesRepo = createBeneficiariesRepo(db);
