import { eq } from "drizzle-orm";
import { type DbInstance, db } from "../index";
import { type CoverageItem, coverageItems, type NewCoverageItem } from "../schema";

export function createCoverageItemsRepo(dbInstance: DbInstance) {
	return {
		async findAll(): Promise<CoverageItem[]> {
			return await dbInstance.select().from(coverageItems).all();
		},

		async findById(id: number): Promise<CoverageItem | undefined> {
			return await dbInstance.select().from(coverageItems).where(eq(coverageItems.id, id)).get();
		},

		async findByPolicyId(policyId: number): Promise<CoverageItem[]> {
			return await dbInstance
				.select()
				.from(coverageItems)
				.where(eq(coverageItems.policyId, policyId))
				.all();
		},

		async create(data: NewCoverageItem): Promise<CoverageItem> {
			return await dbInstance.insert(coverageItems).values(data).returning().get();
		},

		async createMany(data: NewCoverageItem[]): Promise<CoverageItem[]> {
			if (data.length === 0) return [];
			return await dbInstance.insert(coverageItems).values(data).returning().all();
		},

		async update(id: number, data: Partial<NewCoverageItem>): Promise<CoverageItem | undefined> {
			return await dbInstance
				.update(coverageItems)
				.set(data)
				.where(eq(coverageItems.id, id))
				.returning()
				.get();
		},

		async delete(id: number): Promise<boolean> {
			const rows = await dbInstance
				.delete(coverageItems)
				.where(eq(coverageItems.id, id))
				.returning()
				.all();
			return rows.length > 0;
		},

		async deleteByPolicyId(policyId: number): Promise<number> {
			const rows = await dbInstance
				.delete(coverageItems)
				.where(eq(coverageItems.policyId, policyId))
				.returning()
				.all();
			return rows.length;
		},
	};
}

export type CoverageItemsRepo = ReturnType<typeof createCoverageItemsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const coverageItemsRepo = createCoverageItemsRepo(db);
