import { and, count as drizzleCount, eq, inArray } from "drizzle-orm";
import { type DbInstance, db } from "../index";
import { type Attachment, attachments, type NewAttachment } from "../schema";

export function createAttachmentsRepo(dbInstance: DbInstance) {
	return {
		async findByPolicyId(policyId: number): Promise<Attachment[]> {
			return await dbInstance
				.select()
				.from(attachments)
				.where(eq(attachments.policyId, policyId))
				.all();
		},

		async findById(id: number): Promise<Attachment | undefined> {
			return await dbInstance.select().from(attachments).where(eq(attachments.id, id)).get();
		},

		/**
		 * Find attachment by ID and verify it belongs to the given policy.
		 * Prevents IDOR attacks via crafted URLs.
		 */
		async findByIdAndPolicyId(id: number, policyId: number): Promise<Attachment | undefined> {
			return await dbInstance
				.select()
				.from(attachments)
				.where(and(eq(attachments.id, id), eq(attachments.policyId, policyId)))
				.get();
		},

		async create(data: NewAttachment): Promise<Attachment> {
			return await dbInstance.insert(attachments).values(data).returning().get();
		},

		async delete(id: number): Promise<boolean> {
			const rows = await dbInstance
				.delete(attachments)
				.where(eq(attachments.id, id))
				.returning()
				.all();
			return rows.length > 0;
		},

		/**
		 * Delete all attachments for a policy.
		 * Returns the deleted rows so callers can clean up R2 objects.
		 */
		async deleteByPolicyId(policyId: number): Promise<Attachment[]> {
			return await dbInstance
				.delete(attachments)
				.where(eq(attachments.policyId, policyId))
				.returning()
				.all();
		},

		async countByPolicyId(policyId: number): Promise<number> {
			const result = await dbInstance
				.select({ count: drizzleCount() })
				.from(attachments)
				.where(eq(attachments.policyId, policyId))
				.get();
			return result?.count ?? 0;
		},

		/**
		 * Count attachments grouped by policy ID in a single query.
		 * Returns a Map of policyId → count (only includes policies that have attachments).
		 */
		async countGroupedByPolicyIds(policyIds: number[]): Promise<Map<number, number>> {
			if (policyIds.length === 0) return new Map();
			const rows = await dbInstance
				.select({
					policyId: attachments.policyId,
					count: drizzleCount(),
				})
				.from(attachments)
				.where(inArray(attachments.policyId, policyIds))
				.groupBy(attachments.policyId)
				.all();
			return new Map(rows.map((r: { policyId: number; count: number }) => [r.policyId, r.count]));
		},
	};
}

export type AttachmentsRepo = ReturnType<typeof createAttachmentsRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const attachmentsRepo = createAttachmentsRepo(db);
