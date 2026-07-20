import { defineCommand } from "@nocoo/base-cli";
import type { ApiClient } from "../api.js";
import { buildClient } from "../lib/client.js";
import { jsonInputArgs, requireJsonInput } from "../lib/json-input.js";
import { emit, emitList, emitRecord, type Summarizer } from "../output.js";

interface Policy extends Record<string, unknown> {
	id: number;
	policyNumber: string;
	productName: string;
	insurerName: string;
	category: string;
	status: string;
	premium?: number;
	nextDueDate?: string | null;
}

const summarizePolicy: Summarizer<Policy> = (p) => ({
	id: p.id,
	policyNumber: p.policyNumber,
	productName: p.productName,
	insurerName: p.insurerName,
	category: p.category,
	status: p.status,
	nextDueDate: p.nextDueDate,
});

interface Payment extends Record<string, unknown> {
	id: number;
	policyId: number;
	periodNumber: number;
	dueDate: string;
	amount: number;
	status: string;
	paidDate?: string | null;
}

const summarizePayment: Summarizer<Payment> = (p) => ({
	id: p.id,
	periodNumber: p.periodNumber,
	dueDate: p.dueDate,
	amount: p.amount,
	status: p.status,
});

interface Beneficiary extends Record<string, unknown> {
	id: number;
	memberId?: number | null;
	name: string;
	sharePercent: number;
	rankOrder: number;
}

const summarizeBeneficiary: Summarizer<Beneficiary> = (b) => ({
	id: b.id,
	name: b.name,
	sharePercent: b.sharePercent,
	rankOrder: b.rankOrder,
});

interface CoverageItem extends Record<string, unknown> {
	id: number;
	policyId: number;
	name: string;
	periodLimit?: string | null;
	lifetimeLimit?: string | null;
	isOptional?: boolean;
}

const summarizeCoverage: Summarizer<CoverageItem> = (c) => ({
	id: c.id,
	name: c.name,
	periodLimit: c.periodLimit,
	lifetimeLimit: c.lifetimeLimit,
	isOptional: c.isOptional,
});

interface Attachment extends Record<string, unknown> {
	id: number;
	policyId: number;
	filename: string;
	contentType: string;
	size: number;
}

const summarizeAttachment: Summarizer<Attachment> = (a) => ({
	id: a.id,
	filename: a.filename,
	contentType: a.contentType,
	size: a.size,
});

const fullArg = {
	full: {
		type: "boolean" as const,
		description: "Return full record(s) instead of a summary",
		default: false,
	},
} as const;

const policyIdArg = {
	id: {
		type: "positional" as const,
		description: "Policy id",
		required: true,
	},
} as const;

export function definePoliciesCommand(factory: () => ApiClient = buildClient) {
	const client = factory;

	// --- Main CRUD ---
	const ls = defineCommand({
		meta: { name: "ls", description: "List policies" },
		args: { ...fullArg },
		async run({ args }) {
			const rows = await client().get<Policy[]>("/api/policies");
			emitList(rows, summarizePolicy, { full: Boolean(args.full) });
		},
	});

	const get = defineCommand({
		meta: { name: "get", description: "Get a policy by id" },
		args: { ...policyIdArg, ...fullArg },
		async run({ args }) {
			const row = await client().get<Policy>(`/api/policies/${args.id}`);
			emitRecord(row, summarizePolicy, { full: Boolean(args.full) });
		},
	});

	const add = defineCommand({
		meta: { name: "add", description: "Create a policy" },
		args: { ...jsonInputArgs, ...fullArg },
		async run({ args }) {
			const body = requireJsonInput(args);
			const row = await client().post<Policy>("/api/policies", body);
			emitRecord(row, summarizePolicy, { full: Boolean(args.full) });
		},
	});

	const update = defineCommand({
		meta: { name: "update", description: "Update a policy by id" },
		args: { ...policyIdArg, ...jsonInputArgs, ...fullArg },
		async run({ args }) {
			const body = requireJsonInput(args);
			const row = await client().put<Policy>(`/api/policies/${args.id}`, body);
			emitRecord(row, summarizePolicy, { full: Boolean(args.full) });
		},
	});

	const rm = defineCommand({
		meta: { name: "rm", description: "Delete a policy (cascades)" },
		args: { ...policyIdArg },
		async run({ args }) {
			await client().delete(`/api/policies/${args.id}`);
			emit({ ok: true, id: args.id });
		},
	});

	// --- Sub: payments ---
	const paymentsLs = defineCommand({
		meta: { name: "ls", description: "List payments for a policy" },
		args: { ...policyIdArg, ...fullArg },
		async run({ args }) {
			const rows = await client().get<Payment[]>(`/api/policies/${args.id}/payments`);
			emitList(rows, summarizePayment, { full: Boolean(args.full) });
		},
	});

	const paymentsAdd = defineCommand({
		meta: { name: "add", description: "Add a payment record" },
		args: { ...policyIdArg, ...jsonInputArgs, ...fullArg },
		async run({ args }) {
			const body = requireJsonInput(args);
			const row = await client().post<Payment>(`/api/policies/${args.id}/payments`, body);
			emitRecord(row, summarizePayment, { full: Boolean(args.full) });
		},
	});

	const paymentsUpdate = defineCommand({
		meta: { name: "update", description: "Update a payment" },
		args: {
			...policyIdArg,
			paymentId: {
				type: "positional" as const,
				description: "Payment id",
				required: true,
			},
			...jsonInputArgs,
			...fullArg,
		},
		async run({ args }) {
			const body = requireJsonInput(args);
			const row = await client().put<Payment>(
				`/api/policies/${args.id}/payments/${args.paymentId}`,
				body,
			);
			emitRecord(row, summarizePayment, { full: Boolean(args.full) });
		},
	});

	const paymentsRm = defineCommand({
		meta: { name: "rm", description: "Delete a payment" },
		args: {
			...policyIdArg,
			paymentId: {
				type: "positional" as const,
				description: "Payment id",
				required: true,
			},
		},
		async run({ args }) {
			await client().delete(`/api/policies/${args.id}/payments/${args.paymentId}`);
			emit({ ok: true, id: args.paymentId });
		},
	});

	const paymentsGenerate = defineCommand({
		meta: {
			name: "generate",
			description: "Generate missing payment records from the policy schedule",
		},
		args: { ...policyIdArg },
		async run({ args }) {
			const result = await client().post<{
				generated: number;
				payments: Payment[];
			}>(`/api/policies/${args.id}/payments/generate`);
			emit({
				generated: result.generated,
				payments: result.payments.map(summarizePayment),
			});
		},
	});

	const payments = defineCommand({
		meta: { name: "payments", description: "Manage payment records" },
		subCommands: {
			ls: paymentsLs,
			add: paymentsAdd,
			update: paymentsUpdate,
			rm: paymentsRm,
			generate: paymentsGenerate,
		},
	});

	// --- Sub: beneficiaries (read-only on server) ---
	const beneficiariesLs = defineCommand({
		meta: { name: "ls", description: "List beneficiaries for a policy" },
		args: { ...policyIdArg, ...fullArg },
		async run({ args }) {
			const rows = await client().get<Beneficiary[]>(`/api/policies/${args.id}/beneficiaries`);
			emitList(rows, summarizeBeneficiary, { full: Boolean(args.full) });
		},
	});

	const beneficiaries = defineCommand({
		meta: { name: "beneficiaries", description: "View beneficiaries" },
		subCommands: { ls: beneficiariesLs },
	});

	// --- Sub: coverage-items ---
	const coverageLs = defineCommand({
		meta: { name: "ls", description: "List coverage items for a policy" },
		args: { ...policyIdArg, ...fullArg },
		async run({ args }) {
			const rows = await client().get<CoverageItem[]>(`/api/policies/${args.id}/coverage-items`);
			emitList(rows, summarizeCoverage, { full: Boolean(args.full) });
		},
	});

	const coverageGet = defineCommand({
		meta: { name: "get", description: "Get a coverage item" },
		args: {
			...policyIdArg,
			itemId: {
				type: "positional" as const,
				description: "Coverage item id",
				required: true,
			},
			...fullArg,
		},
		async run({ args }) {
			const row = await client().get<CoverageItem>(
				`/api/policies/${args.id}/coverage-items/${args.itemId}`,
			);
			emitRecord(row, summarizeCoverage, { full: Boolean(args.full) });
		},
	});

	const coverageAdd = defineCommand({
		meta: { name: "add", description: "Add a coverage item" },
		args: { ...policyIdArg, ...jsonInputArgs, ...fullArg },
		async run({ args }) {
			const body = requireJsonInput(args);
			const row = await client().post<CoverageItem>(
				`/api/policies/${args.id}/coverage-items`,
				body,
			);
			emitRecord(row, summarizeCoverage, { full: Boolean(args.full) });
		},
	});

	const coverageUpdate = defineCommand({
		meta: { name: "update", description: "Update a coverage item" },
		args: {
			...policyIdArg,
			itemId: {
				type: "positional" as const,
				description: "Coverage item id",
				required: true,
			},
			...jsonInputArgs,
			...fullArg,
		},
		async run({ args }) {
			const body = requireJsonInput(args);
			const row = await client().put<CoverageItem>(
				`/api/policies/${args.id}/coverage-items/${args.itemId}`,
				body,
			);
			emitRecord(row, summarizeCoverage, { full: Boolean(args.full) });
		},
	});

	const coverageRm = defineCommand({
		meta: { name: "rm", description: "Delete a coverage item" },
		args: {
			...policyIdArg,
			itemId: {
				type: "positional" as const,
				description: "Coverage item id",
				required: true,
			},
		},
		async run({ args }) {
			await client().delete(`/api/policies/${args.id}/coverage-items/${args.itemId}`);
			emit({ ok: true, id: args.itemId });
		},
	});

	const coverageItems = defineCommand({
		meta: { name: "coverage-items", description: "Manage coverage items" },
		subCommands: {
			ls: coverageLs,
			get: coverageGet,
			add: coverageAdd,
			update: coverageUpdate,
			rm: coverageRm,
		},
	});

	// --- Sub: attachments ---
	const attachmentsLs = defineCommand({
		meta: { name: "ls", description: "List attachments for a policy" },
		args: { ...policyIdArg, ...fullArg },
		async run({ args }) {
			const rows = await client().get<Attachment[]>(`/api/policies/${args.id}/attachments`);
			emitList(rows, summarizeAttachment, { full: Boolean(args.full) });
		},
	});

	const attachmentsGet = defineCommand({
		meta: { name: "get", description: "Get attachment metadata" },
		args: {
			...policyIdArg,
			attachmentId: {
				type: "positional" as const,
				description: "Attachment id",
				required: true,
			},
			...fullArg,
		},
		async run({ args }) {
			const row = await client().get<Attachment>(
				`/api/policies/${args.id}/attachments/${args.attachmentId}`,
			);
			emitRecord(row, summarizeAttachment, { full: Boolean(args.full) });
		},
	});

	const attachmentsRm = defineCommand({
		meta: { name: "rm", description: "Delete an attachment" },
		args: {
			...policyIdArg,
			attachmentId: {
				type: "positional" as const,
				description: "Attachment id",
				required: true,
			},
		},
		async run({ args }) {
			await client().delete(`/api/policies/${args.id}/attachments/${args.attachmentId}`);
			emit({ ok: true, id: args.attachmentId });
		},
	});

	const attachments = defineCommand({
		meta: { name: "attachments", description: "Manage attachments" },
		subCommands: {
			ls: attachmentsLs,
			get: attachmentsGet,
			rm: attachmentsRm,
		},
	});

	return defineCommand({
		meta: { name: "policies", description: "Manage insurance policies" },
		subCommands: {
			ls,
			get,
			add,
			update,
			rm,
			payments,
			beneficiaries,
			"coverage-items": coverageItems,
			attachments,
		},
	});
}

export const policiesCommand = definePoliciesCommand();
