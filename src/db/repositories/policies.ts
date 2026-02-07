import { eq } from "drizzle-orm";
import { db } from "../index";
import { policies, type Policy, type NewPolicy } from "../schema";

export const policiesRepo = {
  findAll(): Policy[] {
    return db.select().from(policies).all();
  },

  findById(id: number): Policy | undefined {
    return db.select().from(policies).where(eq(policies.id, id)).get();
  },

  findByApplicantId(applicantId: number): Policy[] {
    return db
      .select()
      .from(policies)
      .where(eq(policies.applicantId, applicantId))
      .all();
  },

  findByInsuredMemberId(memberId: number): Policy[] {
    return db
      .select()
      .from(policies)
      .where(eq(policies.insuredMemberId, memberId))
      .all();
  },

  findByStatus(status: Policy["status"]): Policy[] {
    return db.select().from(policies).where(eq(policies.status, status)).all();
  },

  create(data: NewPolicy): Policy {
    return db.insert(policies).values(data).returning().get();
  },

  update(id: number, data: Partial<NewPolicy>): Policy | undefined {
    return db
      .update(policies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(policies).where(eq(policies.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  },
};
