import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { policies, type Policy, type NewPolicy } from "../schema";

export function createPoliciesRepo(dbInstance: DbInstance) {
  return {
    async findAll(): Promise<Policy[]> {
      return await dbInstance.select().from(policies).all();
    },

    async findById(id: number): Promise<Policy | undefined> {
      return await dbInstance.select().from(policies).where(eq(policies.id, id)).get();
    },

    async findByApplicantId(applicantId: number): Promise<Policy[]> {
      return await dbInstance
        .select()
        .from(policies)
        .where(eq(policies.applicantId, applicantId))
        .all();
    },

    async findByInsuredMemberId(memberId: number): Promise<Policy[]> {
      return await dbInstance
        .select()
        .from(policies)
        .where(eq(policies.insuredMemberId, memberId))
        .all();
    },

    async findByStatus(status: Policy["status"]): Promise<Policy[]> {
      return await dbInstance.select().from(policies).where(eq(policies.status, status)).all();
    },

    async create(data: NewPolicy): Promise<Policy> {
      return await dbInstance.insert(policies).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewPolicy>): Promise<Policy | undefined> {
      return await dbInstance
        .update(policies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(policies.id, id))
        .returning()
        .get();
    },

    async delete(id: number): Promise<boolean> {
      const rows = await dbInstance.delete(policies).where(eq(policies.id, id)).returning().all();
      return rows.length > 0;
    },
  };
}

export type PoliciesRepo = ReturnType<typeof createPoliciesRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const policiesRepo = createPoliciesRepo(db);
