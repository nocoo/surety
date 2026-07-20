import { eq } from "drizzle-orm";
import { type DbInstance, db } from "../index";
import { type Member, members, type NewMember } from "../schema";

export function createMembersRepo(dbInstance: DbInstance) {
	return {
		async findAll(): Promise<Member[]> {
			return await dbInstance.select().from(members).all();
		},

		async findById(id: number): Promise<Member | undefined> {
			return await dbInstance.select().from(members).where(eq(members.id, id)).get();
		},

		async create(data: NewMember): Promise<Member> {
			return await dbInstance.insert(members).values(data).returning().get();
		},

		async update(id: number, data: Partial<NewMember>): Promise<Member | undefined> {
			return await dbInstance
				.update(members)
				.set({ ...data, updatedAt: new Date() })
				.where(eq(members.id, id))
				.returning()
				.get();
		},

		async delete(id: number): Promise<boolean> {
			const rows = await dbInstance.delete(members).where(eq(members.id, id)).returning().all();
			return rows.length > 0;
		},
	};
}

export type MembersRepo = ReturnType<typeof createMembersRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const membersRepo = createMembersRepo(db);
