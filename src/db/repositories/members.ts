import { eq } from "drizzle-orm";
import { db } from "../index";
import { members, type Member, type NewMember } from "../schema";

export const membersRepo = {
  findAll(): Member[] {
    return db.select().from(members).all();
  },

  findById(id: number): Member | undefined {
    return db.select().from(members).where(eq(members.id, id)).get();
  },

  create(data: NewMember): Member {
    return db.insert(members).values(data).returning().get();
  },

  update(id: number, data: Partial<NewMember>): Member | undefined {
    return db
      .update(members)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(members.id, id))
      .returning()
      .get();
  },

  delete(id: number): boolean {
    const result = db.delete(members).where(eq(members.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  },
};
