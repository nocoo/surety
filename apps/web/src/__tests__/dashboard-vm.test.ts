import { afterEach, describe, expect, it, vi } from "vitest";
import type {
	CategoryData,
	CoverageData,
	DashboardCharts,
	DashboardStats,
} from "@/lib/dashboard-vm";
import { createStatCards, fetchDashboardData } from "@/lib/dashboard-vm";

const baseStats: DashboardStats = {
	policyCount: 12,
	memberCount: 5,
	totalPremium: 50_000,
	protectionPremium: 35_000,
	savingsPremium: 15_000,
	totalSumAssured: 6_000_000,
};

function makeCharts(over: Partial<DashboardCharts> = {}): DashboardCharts {
	return {
		premiumByCategory: [],
		premiumByMember: [],
		policyByInsurer: [],
		policyByChannel: [],
		coverageByCategory: [],
		memberByCategory: { data: [], categories: [] },
		memberPremiumByCategory: { data: [], categories: [] },
		memberCoverageByCategory: { data: [], categories: [] },
		renewalTimeline: { data: [], categories: [] },
		expiryTimeline: { data: [], categories: [] },
		...over,
	};
}

function cat(over: Partial<CategoryData>): CategoryData {
	return {
		category: "Life",
		label: "定期寿",
		count: 0,
		premium: 0,
		sumAssured: 0,
		...over,
	};
}

function cov(over: Partial<CoverageData>): CoverageData {
	return { label: "定期寿", sumAssured: 0, ...over };
}

describe("createStatCards", () => {
	it("returns 4 cards; chart-derived subs absent without charts, stats-derived sub present", () => {
		const cards = createStatCards(baseStats);
		expect(cards).toHaveLength(4);
		expect(cards[0]?.sub).toBeUndefined(); // category dominance needs charts
		expect(cards[1]?.sub).toBe("人均 2.4 份保单"); // pure stats
		expect(cards[2]?.sub).toBeUndefined(); // premium % needs charts
		expect(cards[3]?.sub).toBeUndefined(); // coverage % needs charts
	});

	it("保单总数: surfaces the dominant category by count", () => {
		const cards = createStatCards(
			baseStats,
			makeCharts({
				premiumByCategory: [
					cat({ label: "定期寿", count: 3 }),
					cat({ label: "重疾险", count: 7 }),
					cat({ label: "意外险", count: 2 }),
				],
			}),
		);
		expect(cards[0]?.sub).toBe("重疾险 7 份占多数");
	});

	it("家庭成员: shows average policies per member (one-decimal under 10)", () => {
		const cards = createStatCards(baseStats, makeCharts());
		expect(cards[1]?.sub).toBe("人均 2.4 份保单");
	});

	it("家庭成员: omits the sub-line when memberCount or policyCount is zero", () => {
		const empty = createStatCards({ ...baseStats, memberCount: 0 }, makeCharts());
		expect(empty[1]?.sub).toBeUndefined();
		const noPolicies = createStatCards({ ...baseStats, policyCount: 0 }, makeCharts());
		expect(noPolicies[1]?.sub).toBeUndefined();
	});

	it("年保费: percentage share of the dominant category", () => {
		const cards = createStatCards(
			baseStats,
			makeCharts({
				premiumByCategory: [
					cat({ label: "定期寿", premium: 30_000 }),
					cat({ label: "重疾险", premium: 20_000 }),
				],
			}),
		);
		// 30000 / 50000 = 60%
		expect(cards[2]?.sub).toBe("定期寿占 60%");
	});

	it("总保额: percentage share of the dominant category", () => {
		const cards = createStatCards(
			baseStats,
			makeCharts({
				coverageByCategory: [
					cov({ label: "重疾险", sumAssured: 5_000_000 }),
					cov({ label: "定期寿", sumAssured: 1_000_000 }),
				],
			}),
		);
		// 5m / 6m ≈ 83%
		expect(cards[3]?.sub).toBe("重疾险占 83%");
	});

	it("omits the percentage sub-lines when totals are zero", () => {
		const cards = createStatCards(
			{ ...baseStats, totalPremium: 0, totalSumAssured: 0 },
			makeCharts({
				premiumByCategory: [cat({ label: "x", premium: 0 })],
				coverageByCategory: [cov({ label: "x", sumAssured: 0 })],
			}),
		);
		expect(cards[2]?.sub).toBeUndefined();
		expect(cards[3]?.sub).toBeUndefined();
	});

	it("omits the dominant-category sub-line when every count is zero", () => {
		const cards = createStatCards(
			baseStats,
			makeCharts({
				premiumByCategory: [cat({ label: "定期寿", count: 0 }), cat({ label: "重疾险", count: 0 })],
			}),
		);
		expect(cards[0]?.sub).toBeUndefined();
	});
});

describe("fetchDashboardData", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed JSON on a 200 response", async () => {
		const payload = { stats: baseStats };
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(payload), { status: 200 }),
		);
		const data = await fetchDashboardData();
		expect(data).toEqual(payload);
	});

	it("throws including the HTTP status on a non-2xx response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
		await expect(fetchDashboardData()).rejects.toThrow(/500/);
	});
});
