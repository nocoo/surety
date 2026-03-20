import { eq } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { members, type Member, type NewMember } from "../schema";

export function createMembersRepo(dbInstance: DbInstance) {
  return {
    findAll(): Member[] {
      return dbInstance.select().from(members).all();
    },

    findById(id: number): Member | undefined {
      return dbInstance.select().from(members).where(eq(members.id, id)).get();
    },

    create(data: NewMember): Member {
      return dbInstance.insert(members).values(data).returning().get();
    },

    update(id: number, data: Partial<NewMember>): Member | undefined {
      return dbInstance
        .update(members)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(members.id, id))
        .returning()
        .get();
    },

    delete(id: number): boolean {
      const result = dbInstance.delete(members).where(eq(members.id, id)).run() as unknown as { changes: number };
      return result.changes > 0;
    },
  };
}

export type MembersRepo = ReturnType<typeof createMembersRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const membersRepo = createMembersRepo(db);
