import type { PolicyStatus } from "@surety/db/types";

export type { PolicyStatus };

/**
 * Full policy detail returned by GET /api/policies/[id].
 * Includes resolved names from joined member/asset/insurer tables.
 */
export interface PolicyDetail {
	id: number;
	policyNumber: string;
	productName: string;
	insurerName: string;
	insuredName: string;
	insuredAssetName: string | null;
	applicantName?: string;
	applicantId: number;
	insuredType: "Member" | "Asset";
	insuredMemberId: number | null;
	insuredAssetId: number | null;
	category: string;
	subCategory: string | null;
	channel: string | null;
	status: PolicyStatus;
	premium: number;
	sumAssured: number;
	paymentFrequency: string;
	paymentYears: number | null;
	totalPayments: number | null;
	renewalType: string | null;
	paymentAccount: string | null;
	nextDueDate: string | null;
	effectiveDate: string;
	expiryDate: string | null;
	hesitationEndDate: string | null;
	waitingDays: number | null;
	guaranteedRenewalYears: number | null;
	deathBenefit: string | null;
	policyFilePath: string | null;
	notes: string | null;
	terminatedAt: string | null;
	terminationReason: string | null;
	plannedSurrenderAt: string | null;
	plannedSurrenderNote: string | null;
}

/**
 * Summary policy for list views (lighter than PolicyDetail).
 */
export interface PolicySummary {
	id: number;
	policyNumber: string;
	productName: string;
	insurerName: string;
	insuredName: string;
	insuredAssetId: number | null;
	insuredAssetName: string | null;
	category: string;
	subCategory: string | null;
	status: PolicyStatus;
	premium: number;
	sumAssured: number;
	nextDueDate: string | null;
	effectiveDate: string;
	expiryDate: string | null;
	channel: string | null;
}

export interface CoverageItem {
	id: number;
	policyId: number;
	name: string;
	periodLimit: number | null;
	lifetimeLimit: number | null;
	deductible: number | null;
	coveragePercent: number | null;
	isOptional: boolean | number;
	notes: string | null;
	sortOrder: number;
}

export interface Beneficiary {
	id: number;
	name: string;
	sharePercent: number;
	rankOrder: number;
}

export interface Payment {
	id: number;
	periodNumber: number;
	dueDate: string;
	amount: number;
	status: "Pending" | "Paid" | "Overdue";
	paidDate: string | null;
	paidAmount: number | null;
}
