/**
 * Unit tests for buildTimeline() — the pure event derivation behind
 * TimelineColumn. Each case fixes "today" via vi.useFakeTimers so the
 * past/future classification and the today-marker behaviour are
 * deterministic.
 */

import { deriveDisplayStatus } from "@surety/db/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline } from "../components/policy-detail/timeline-column";
import type { PolicyDetail } from "../lib/types/policy";

function basePolicy(overrides: Partial<PolicyDetail> = {}): PolicyDetail {
	return {
		id: 1,
		policyNumber: "P-1",
		productName: "Test",
		insurerName: "Ins",
		insuredName: "Insured",
		insuredAssetName: null,
		applicantName: "Applicant",
		applicantId: 1,
		insuredType: "Member",
		insuredMemberId: 1,
		insuredAssetId: null,
		category: "Medical",
		subCategory: null,
		channel: null,
		status: "Active",
		premium: 1000,
		sumAssured: 100000,
		paymentFrequency: "Yearly",
		paymentYears: null,
		totalPayments: 3,
		renewalType: null,
		paymentAccount: null,
		nextDueDate: null,
		effectiveDate: "2026-01-15",
		expiryDate: null,
		hesitationEndDate: null,
		waitingDays: null,
		guaranteedRenewalYears: null,
		deathBenefit: null,
		policyFilePath: null,
		notes: null,
		terminatedAt: null,
		terminationReason: null,
		plannedSurrenderAt: null,
		plannedSurrenderNote: null,
		...overrides,
	};
}

beforeEach(() => {
	// Freeze today at 2026-06-22 local-time noon.
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 5, 22, 12, 0, 0));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("buildTimeline — termination", () => {
	it("filters out future payment events that fall strictly after terminatedAt", () => {
		// 3 yearly payments: 2026-01-15 / 2027-01-15 / 2028-01-15.
		// Terminate on 2026-06-15 → only 2026 payment survives.
		const events = buildTimeline(
			basePolicy({
				status: "Surrendered",
				terminatedAt: "2026-06-15",
			}),
		);
		const labels = events.map((e) => e.label);
		expect(labels).toContain("第 1 期缴费");
		expect(labels).not.toContain("第 2 期缴费");
		expect(labels).not.toContain("第 3 期缴费");
	});

	it("suppresses the today marker in terminated state", () => {
		const events = buildTimeline(
			basePolicy({
				status: "Surrendered",
				terminatedAt: "2026-06-15",
			}),
		);
		expect(events.find((e) => e.label === "今天")).toBeUndefined();
	});

	it("inserts a termination milestone with the correct label, date and ordering", () => {
		const events = buildTimeline(
			basePolicy({
				status: "Claimed",
				terminatedAt: "2026-06-15",
			}),
		);
		const milestone = events.find((e) => e.label === "理赔结案");
		expect(milestone).toBeDefined();
		expect(milestone?.dateStr).toBe("2026-06-15");
		expect(milestone?.type).toBe("today");

		// Surrendered + Lapsed label coverage.
		const surr = buildTimeline(basePolicy({ status: "Surrendered", terminatedAt: "2026-06-15" }));
		expect(surr.some((e) => e.label === "退保")).toBe(true);
		const lapsed = buildTimeline(basePolicy({ status: "Lapsed", terminatedAt: "2026-06-15" }));
		expect(lapsed.some((e) => e.label === "失效")).toBe(true);

		// Ordering: earlier event (effective 2026-01-15) comes before the
		// 2026-06-15 milestone.
		const eff = events.findIndex((e) => e.label === "生效日期");
		const mile = events.findIndex((e) => e.label === "理赔结案");
		expect(eff).toBeGreaterThanOrEqual(0);
		expect(mile).toBeGreaterThan(eff);
	});

	it("does not insert a planned-surrender milestone when terminated, even if the field is set", () => {
		const events = buildTimeline(
			basePolicy({
				status: "Surrendered",
				terminatedAt: "2026-06-15",
				plannedSurrenderAt: "2027-01-01",
			}),
		);
		expect(events.find((e) => e.label === "计划退保")).toBeUndefined();
	});

	it("keeps same-day events: payment whose dueDate equals terminatedAt stays visible (boundary pin)", () => {
		// effectiveDate and the single payment both fall on 2026-01-15.
		// The filter is `eventDate <= terminatedAt`, so changing it to a
		// strict `<` would silently drop the same-day payment. This test
		// pins the boundary.
		const events = buildTimeline(
			basePolicy({
				status: "Surrendered",
				terminatedAt: "2026-01-15",
				totalPayments: 1,
			}),
		);
		expect(events.find((e) => e.label === "第 1 期缴费")).toBeDefined();
		expect(events.find((e) => e.label === "退保")).toBeDefined();
		expect(events.find((e) => e.label === "今天")).toBeUndefined();
	});
});

describe("buildTimeline — planned surrender", () => {
	it("inserts a 计划退保 milestone when display status is Active and plannedSurrenderAt is set", () => {
		const events = buildTimeline(
			basePolicy({
				status: "Active",
				plannedSurrenderAt: "2027-03-01",
			}),
		);
		const planned = events.find((e) => e.label === "计划退保");
		expect(planned).toBeDefined();
		expect(planned?.dateStr).toBe("2027-03-01");
		expect(planned?.type).toBe("future");

		// Other events still present and untouched.
		expect(events.find((e) => e.label === "生效日期")).toBeDefined();
		expect(events.find((e) => e.label === "今天")).toBeDefined();
		expect(events.filter((e) => e.label.startsWith("第")).length).toBe(3);
	});

	it("inserts a 计划退保 milestone when display status is Expired (past expiryDate)", () => {
		// Active in DB + expiryDate in the past → display status would be
		// Expired. We test the buildTimeline branch directly by passing
		// status="Expired" because deriveDisplayStatus runs upstream.
		const events = buildTimeline(
			basePolicy({
				status: "Expired",
				expiryDate: "2025-12-31",
				plannedSurrenderAt: "2027-03-01",
			}),
		);
		expect(events.find((e) => e.label === "计划退保")).toBeDefined();
	});

	it("end-to-end: deriveDisplayStatus(Active, past expiryDate) → Expired → milestone still appears", () => {
		// Anchor the upstream gate to the same derivation the API layer uses
		// (apps/worker/src/routes/policies.ts wraps GET responses with
		// deriveDisplayStatus). If that helper ever stops mapping
		// (Active, past) → "Expired", the previous direct-Expired test would
		// still pass; this one would not.
		const dbStatus = "Active" as const;
		const expiryDate = "2025-12-31";
		const displayStatus = deriveDisplayStatus(dbStatus, expiryDate);
		expect(displayStatus).toBe("Expired");

		const events = buildTimeline(
			basePolicy({
				status: displayStatus,
				expiryDate,
				plannedSurrenderAt: "2027-03-01",
			}),
		);
		expect(events.find((e) => e.label === "计划退保")).toBeDefined();
	});

	it("omits 计划退保 when plannedSurrenderAt is null", () => {
		const events = buildTimeline(basePolicy({ status: "Active" }));
		expect(events.find((e) => e.label === "计划退保")).toBeUndefined();
	});
});
