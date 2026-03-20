import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { policies, type Policy, type NewPolicy } from "../schema";

export function createPoliciesRepo(dbInstance: DbInstance) {
  return {
    findAll(): Policy[] {
      return dbInstance.select().from(policies).all();
    },

    findById(id: number): Policy | undefined {
      return dbInstance.select().from(policies).where(eq(policies.id, id)).get();
    },

    findByApplicantId(applicantId: number): Policy[] {
      return dbInstance
        .select()
        .from(policies)
        .where(eq(policies.applicantId, applicantId))
        .all();
    },

    findByInsuredMemberId(memberId: number): Policy[] {
      return dbInstance
        .select()
        .from(policies)
        .where(eq(policies.insuredMemberId, memberId))
        .all();
    },

    findByStatus(status: Policy["status"]): Policy[] {
      return dbInstance.select().from(policies).where(eq(policies.status, status)).all();
    },

    create(data: NewPolicy): Policy {
      return dbInstance.insert(policies).values(data).returning().get();
    },

    update(id: number, data: Partial<NewPolicy>): Policy | undefined {
      return dbInstance
        .update(policies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(policies.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(policies).where(eq(policies.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },
  };
}

export type PoliciesRepo = ReturnType<typeof createPoliciesRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const policiesRepo = createPoliciesRepo(db);
