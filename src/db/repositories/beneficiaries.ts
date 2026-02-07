import { eq } from "drizzle-orm";
import { db } from "../index";
import { beneficiaries, type Beneficiary, type NewBeneficiary } from "../schema";

export const beneficiariesRepo = {
  findAll(): Beneficiary[] {
    return db.select().from(beneficiaries).all();
  },

  findById(id: number): Beneficiary | undefined {
    return db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).get();
  },

  findByPolicyId(policyId: number): Beneficiary[] {
    return db
      .select()
      .from(beneficiaries)
      .where(eq(beneficiaries.policyId, policyId))
      .all();
  },

  create(data: NewBeneficiary): Beneficiary {
    return db.insert(beneficiaries).values(data).returning().get();
  },

  update(id: number, data: Partial<NewBeneficiary>): Beneficiary | undefined {
    return db
      .update(beneficiaries)
      .set(data)
      .where(eq(beneficiaries.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(beneficiaries).where(eq(beneficiaries.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  },

  deleteByPolicyId(policyId: number): number {
    const result = db
      .delete(beneficiaries)
      .where(eq(beneficiaries.policyId, policyId))
      .run() as unknown as { changes: number };
    return result.changes;
  },
};
