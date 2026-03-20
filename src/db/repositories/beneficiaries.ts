import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { beneficiaries, type Beneficiary, type NewBeneficiary } from "../schema";

export function createBeneficiariesRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Beneficiary[]> {
      return await dbInstance.select().from(beneficiaries).all();
    },

    async findById(id: number): Promise<Beneficiary | undefined> {
      return await dbInstance.select().from(beneficiaries).where(eq(beneficiaries.id, id)).get();
    },

    async findByPolicyId(policyId: number): Promise<Beneficiary[]> {
      return await dbInstance
        .select()
        .from(beneficiaries)
        .where(eq(beneficiaries.policyId, policyId))
        .all();
    },

    async create(data: NewBeneficiary): Promise<Beneficiary> {
      return await dbInstance.insert(beneficiaries).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewBeneficiary>): Promise<Beneficiary | undefined> {
      return await dbInstance
        .update(beneficiaries)
        .set(data)
        .where(eq(beneficiaries.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance.delete(beneficiaries).where(eq(beneficiaries.id, id)).returning().all();
      return rows.length > 0;
    },

    async deleteByPolicyId(policyId: number): Promise<number> {
      const rows = await dbInstance
        .delete(beneficiaries)
        .where(eq(beneficiaries.policyId, policyId))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type BeneficiariesRepo = ReturnType<typeof createBeneficiariesRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const beneficiariesRepo = createBeneficiariesRepo(db);
